import { findSimilarCases, type KnowledgeCase } from "./similarCasesDb";
import { classifyDesenseCase } from "./rfDesenseTaxonomy";
import { ChatAttachment, SignatureTag } from "./mockData";
import { extractCoreRfSignatures } from "@shared/rfFipRuleCatalog";
import {
  canonicalizeSignatures,
  findPendingAliasCandidates,
  resolveAliasesInText,
  type SignatureAliasEntry,
  type SignatureAliasCandidate,
} from "./signatureAliasResolver";
import {
  buildSignatureRelationHints,
  requiredMissingInfoFromRelations,
  type SignatureRelationHint,
} from "./signatureConceptRegistry";
import { getSignatureGroupWeight, getSignatureTagGroupWeight, type SignatureWeightRule } from "./signatureWeights";
import { splitSignatureTags } from "./signatureTagGroups";

export interface LocalEvidenceItem {
  id: string;
  type: "signature" | "classification" | "rationale" | "diagnostic_test" | "missing_info" | "similar_case" | "attachment";
  label: string;
  detail: string;
  source: "local-rule" | "taxonomy" | "knowledge-db" | "attachment";
  weight: "high" | "medium" | "low";
}

export interface LocalEvidencePacket {
  version: 1;
  inputSummary: string;
  extractedTags: SignatureTag[];
  mergedSignatures: SignatureTag[];
  classification: string;
  mechanism: string;
  rationale: string[];
  diagnosticTests: string[];
  missingInfo: string[];
  similarCases: Array<{ id: string; title: string; similarity: number }>;
  pendingAliasCandidates?: SignatureAliasCandidate[];
  conceptRelationHints?: SignatureRelationHint[];
  evidence: LocalEvidenceItem[];
}

function addTag(tags: SignatureTag[], key: string, value?: string) {
  if (!value?.trim()) return;
  const exists = tags.some(tag => tag.key.toLowerCase() === key.toLowerCase() && tag.value.toLowerCase() === value.toLowerCase());
  if (!exists) tags.push({ key, value, isNew: true });
}

export function extractRfSignatures(text: string, signatureAliasDictionary?: SignatureAliasEntry[]): SignatureTag[] {
  const tags: SignatureTag[] = [];
  for (const signature of extractCoreRfSignatures(text)) {
    addTag(tags, signature.key, signature.value);
  }

  for (const aliasTag of resolveAliasesInText(text, signatureAliasDictionary)) {
    addTag(tags, aliasTag.key, aliasTag.value);
  }

  return canonicalizeSignatures(tags, signatureAliasDictionary);
}

export function mergeSignatures(base: SignatureTag[], additions: SignatureTag[], signatureAliasDictionary?: SignatureAliasEntry[]): SignatureTag[] {
  const merged = canonicalizeSignatures(base, signatureAliasDictionary);
  for (const tag of canonicalizeSignatures(additions, signatureAliasDictionary)) {
    const sameKey = merged.findIndex(item => item.key.toLowerCase() === tag.key.toLowerCase());
    if (sameKey >= 0) {
      if (merged[sameKey].value.toLowerCase() !== tag.value.toLowerCase()) {
        merged[sameKey] = { ...merged[sameKey], value: tag.value, isNew: true };
      }
    } else {
      merged.push(tag);
    }
  }
  return merged;
}

function buildWeightedMissingInfo(merged: SignatureTag[], text: string, signatureWeightRules?: SignatureWeightRule[]): string[] {
  const missing: Array<{ text: string; key: string }> = [];
  const hasKey = (key: string) => merged.some(tag => tag.key === key);
  if (!hasKey("Tx Power")) missing.push({ text: "Tx power sweep result", key: "Tx Power" });
  if (!hasKey("Conducted Result")) missing.push({ text: "Conducted RX baseline", key: "Conducted Result" });
  if (!hasKey("OTA Result")) missing.push({ text: "OTA TIS/EIS or chamber reproduction result", key: "OTA Result" });
  if (!hasKey("IM Product") && /tx|ca|pim|송신|고출력/i.test(text)) {
    missing.push({ text: "IM3/IM5 frequency calculation", key: "IM Product" });
  }
  for (const relationMissing of requiredMissingInfoFromRelations(merged)) {
    if (!missing.some(item => item.text === relationMissing.text)) missing.push(relationMissing);
  }
  return missing
    .sort((a, b) =>
      getSignatureGroupWeight(b.key, "workflow", signatureWeightRules) -
      getSignatureGroupWeight(a.key, "workflow", signatureWeightRules)
    )
    .map(item => item.text);
}

function summarizeAttachment(attachment: ChatAttachment): string[] {
  const facts: string[] = [];
  const descriptor = `${attachment.name} ${attachment.mimeType ?? ""}`.trim();
  if (attachment.type === "table" && attachment.rows?.length) {
    const rowCount = Math.max(0, attachment.rows.length - 1);
    facts.push(`Table attachment ${descriptor} has ${rowCount} data row(s).`);
    const flattened = attachment.rows.flat().join(" ");
    if (/tx|rx|ota|tis|eis|pim|im3|im5|dbm?|sensitivity|desense|감도|송신|수신/i.test(flattened)) {
      facts.push(`Table attachment ${descriptor} contains RF measurement keywords.`);
    }
  } else if (attachment.type === "image") {
    facts.push(`Image attachment ${descriptor} is available for later OCR or visual analysis.`);
  } else if (attachment.type === "url") {
    facts.push(`URL/reference attachment ${descriptor} is linked as supporting material.`);
  } else {
    facts.push(`File attachment ${descriptor} metadata is available; deep parsing is deferred.`);
  }
  return facts;
}

export function buildAttachmentEvidence(attachments: ChatAttachment[] = []): LocalEvidenceItem[] {
  return attachments.flatMap((attachment, attachmentIndex) =>
    summarizeAttachment(attachment).map((fact, factIndex) => ({
      id: `attachment-${attachmentIndex + 1}-${factIndex + 1}`,
      type: "attachment" as const,
      label: attachment.name,
      detail: fact,
      source: "attachment" as const,
      weight: attachment.type === "table" ? "medium" as const : "low" as const,
    }))
  );
}

export function buildLocalEvidencePacket(input: {
  text: string;
  existingSignatures: SignatureTag[];
  quotedSource?: string;
  attachments?: ChatAttachment[];
  signatureWeightRules?: SignatureWeightRule[];
  knowledgeCases?: KnowledgeCase[];
  signatureAliasDictionary?: SignatureAliasEntry[];
}): LocalEvidencePacket {
  const extractedTags = extractRfSignatures(input.text, input.signatureAliasDictionary);
  const merged = mergeSignatures(input.existingSignatures, extractedTags, input.signatureAliasDictionary);
  const signatureGroups = splitSignatureTags(merged);
  const extractedGroups = splitSignatureTags(extractedTags);
  const insight = classifyDesenseCase(merged, input.text);
  const missing = buildWeightedMissingInfo(signatureGroups.analysisSignatures, input.text, input.signatureWeightRules);
  const pendingAliasCandidates = findPendingAliasCandidates(input.text, 0.72, input.signatureAliasDictionary);
  const conceptRelationHints = buildSignatureRelationHints(signatureGroups.analysisSignatures);
  const similarCases = findSimilarCases(
    merged,
    20,
    3,
    input.signatureWeightRules,
    input.knowledgeCases,
    input.signatureAliasDictionary,
  ).map(item => ({
    id: item.id,
    title: item.title,
    similarity: item.similarity ?? 0,
  }));
  const evidence: LocalEvidenceItem[] = [
    ...extractedGroups.analysisSignatures.map((tag, index) => ({
      id: `sig-${index + 1}`,
      type: "signature" as const,
      label: `${tag.key}=${tag.value}`,
      detail: "사용자 입력에서 local rule로 추출한 RF signature입니다.",
      source: "local-rule" as const,
      weight: getSignatureTagGroupWeight(tag, "analysis", input.signatureWeightRules) >= 4 ? "high" as const : "medium" as const,
    })),
    {
      id: "classification",
      type: "classification",
      label: insight.category,
      detail: insight.mechanism,
      source: "taxonomy",
      weight: "high",
    },
    ...insight.decisionRationale.map((reason, index) => ({
      id: `rationale-${index + 1}`,
      type: "rationale" as const,
      label: "분류 판단 근거",
      detail: reason,
      source: "taxonomy" as const,
      weight: "high" as const,
    })),
    ...insight.diagnosticTests.map((test, index) => ({
      id: `test-${index + 1}`,
      type: "diagnostic_test" as const,
      label: "권장 판별 시험",
      detail: test,
      source: "taxonomy" as const,
      weight: "medium" as const,
    })),
    ...missing.map((item, index) => ({
      id: `missing-${index + 1}`,
      type: "missing_info" as const,
      label: "부족 정보",
      detail: item,
      source: "local-rule" as const,
      weight: "medium" as const,
    })),
    ...conceptRelationHints.map((hint, index) => ({
      id: `relation-${index + 1}`,
      type: "rationale" as const,
      label: "Signature 관계",
      detail: `${hint.sourceKey}=${hint.sourceValue}: ${hint.reason}`,
      source: "local-rule" as const,
      weight: hint.type === "requires" ? "medium" as const : "low" as const,
    })),
    ...similarCases.map((item, index) => ({
      id: `similar-${index + 1}`,
      type: "similar_case" as const,
      label: `${item.id} ${item.title}`,
      detail: `Signature similarity ${item.similarity}%`,
      source: "knowledge-db" as const,
      weight: item.similarity >= 70 ? "high" as const : "medium" as const,
    })),
    ...buildAttachmentEvidence(input.attachments),
  ];

  return {
    version: 1,
    inputSummary: input.text.slice(0, 500),
    extractedTags,
    mergedSignatures: merged,
    classification: insight.category,
    mechanism: insight.mechanism,
    rationale: insight.decisionRationale,
    diagnosticTests: insight.diagnosticTests,
    missingInfo: missing,
    similarCases,
    pendingAliasCandidates,
    conceptRelationHints,
    evidence,
  };
}

export function generateLocalRfReply(input: {
  text: string;
  existingSignatures: SignatureTag[];
  quotedSource?: string;
  attachments?: ChatAttachment[];
  signatureWeightRules?: SignatureWeightRule[];
  knowledgeCases?: KnowledgeCase[];
  signatureAliasDictionary?: SignatureAliasEntry[];
}): { content: string; extractedTags: SignatureTag[]; evidencePacket: LocalEvidencePacket } {
  const evidencePacket = buildLocalEvidencePacket(input);
  const similarCases = evidencePacket.similarCases.slice(0, 2);
  const displayMissing = evidencePacket.missingInfo;
  const extractedTags = evidencePacket.extractedTags;
  const insight = {
    category: evidencePacket.classification,
    decisionRationale: evidencePacket.rationale,
    diagnosticTests: evidencePacket.diagnosticTests,
  };
  const contextLine = input.quotedSource
    ? `인용하신 "${input.quotedSource}" 내용을 이전 분석 맥락으로 반영했습니다.`
    : "현재 채팅 입력과 기존 Signature를 함께 보았습니다.";

  return {
    extractedTags,
    evidencePacket,
    content: [
      `우선 분류: ${insight.category}`,
      "",
      `판단 근거: ${insight.decisionRationale.join(" / ")}`,
      "",
      `권장 판별 시험:\n${insight.diagnosticTests.map(test => `- ${test}`).join("\n")}`,
      "",
      `부족 정보:\n${displayMissing.length ? displayMissing.map(item => `- ${item}`).join("\n") : "- 현재 입력 기준으로 핵심 분기 정보는 대부분 확보되었습니다."}`,
      "",
      similarCases.length
        ? `유사 사례: ${similarCases.map(item => `${item.id} ${item.title} (${item.similarity}%)`).join(" / ")}`
        : "유사 사례: 아직 충분히 가까운 사례가 없습니다. Signature를 더 보강하면 검색 품질이 올라갑니다.",
      "",
      `사용한 맥락: ${contextLine}`,
    ].join("\n"),
  };
}
