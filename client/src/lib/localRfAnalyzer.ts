import { findSimilarCases } from "./similarCasesDb";
import { classifyDesenseCase } from "./rfDesenseTaxonomy";
import { ChatAttachment, SignatureTag } from "./mockData";
import {
  canonicalizeSignatures,
  findPendingAliasCandidates,
  resolveAliasesInText,
  type SignatureAliasCandidate,
} from "./signatureAliasResolver";
import { getSignatureGroupWeight, type SignatureWeightRule } from "./signatureWeights";

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
  evidence: LocalEvidenceItem[];
}

function addTag(tags: SignatureTag[], key: string, value: string) {
  if (!value.trim()) return;
  const exists = tags.some(tag => tag.key.toLowerCase() === key.toLowerCase() && tag.value.toLowerCase() === value.toLowerCase());
  if (!exists) tags.push({ key, value, isNew: true });
}

function extractFirst(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1];
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

export function extractRfSignatures(text: string): SignatureTag[] {
  const tags: SignatureTag[] = [];
  const normalized = text.toLowerCase();

  const band = extractFirst(text, /\b((?:B|n)\d{1,3})\b/i);
  if (band) addTag(tags, "Band", band.toUpperCase());

  const caCombo = extractFirst(text, /\b((?:B|n)\d{1,3}\s*\+\s*(?:B|n)\d{1,3}(?:\s*\+\s*(?:B|n)\d{1,3})*)\b/i);
  if (caCombo) addTag(tags, "CA Combo", caCombo.replace(/\s+/g, "").toUpperCase());

  const degradation = extractFirst(text, /(\d+(?:\.\d+)?)\s*dB(?!m)/i);
  if (degradation) addTag(tags, "Degradation (dB)", `${degradation}dB`);

  if (hasAny(text, [/desense/i, /sensitivity\s*(drop|degrad|loss)/i, /감도\s*(저하|열화|하락)/i, /수신\s*감도/i])) {
    addTag(tags, "Desense Type", "Sensitivity Drop");
  }

  const txPower = extractFirst(text, /(?:tx|ul|송신|출력)[^\d]{0,16}(\d+(?:\.\d+)?)\s*dBm/i);
  if (txPower) {
    addTag(tags, "Tx Power", `${txPower}dBm`);
    addTag(tags, "Tx Correlated", "True");
  }

  if (/tx\s*on|ul power|송신|고출력|pa\b|dBm/i.test(text)) {
    addTag(tags, "Tx Dependency", txPower ? "High power only" : "Check required");
    addTag(tags, "Tx Correlated", "True");
  }

  if (/tx\s*off|송신\s*off|송신\s*꺼|tx\s*꺼/i.test(text)) {
    addTag(tags, "Conducted Result", "Tx OFF baseline mentioned");
  }

  if (/conducted|전도|케이블|rf cable/i.test(text)) {
    addTag(tags, "Conducted Result", /정상|normal|pass/i.test(text) ? "Normal" : "Check required");
  }

  if (/ota|tis|eis|방사|안테나/i.test(text)) {
    addTag(tags, "OTA Result", /fail|불량|저하|나쁨/i.test(text) ? "Fail" : "Check required");
  }

  if (/압력|press|누르|pressure/i.test(text)) {
    addTag(tags, "Pressure Sensitive", "True");
    addTag(tags, "Diagnostic Gate", "Pressure A/B test");
  }

  if (/drop|낙하|충격/i.test(text)) {
    addTag(tags, "Drop History", "True");
    addTag(tags, "Mechanical Stress", "Drop");
  }

  if (/c-?clip|shield|screw|bracket|spring|foam|strap|feed|접촉|스크류|쉴드|브라켓|스프링/i.test(text)) {
    addTag(tags, "PIM Risk", "High");
    addTag(tags, "Contact Structure", /shield|쉴드/i.test(text) ? "Shield Contact" : "Mechanical Contact");
  }

  if (/im3|im5|2f|3f|pim|혼변조|intermod/i.test(text)) {
    addTag(tags, "Desense Category", "TX-induced PIM Desense");
    addTag(tags, "Mechanism", "Contact nonlinearity / IM product");
    addTag(tags, "IM Product", /im5/i.test(normalized) ? "IM5 mentioned" : "IM3 mentioned");
  }

  if (/display|mipi|camera|usb|ddr|pmic|dcdc|dc-dc|charging|충전|전원|카메라|디스플레이/i.test(text)) {
    addTag(tags, "Desense Category", "Internal Desense / Spurious");
    addTag(tags, "Noise Source", /pmic|dcdc|dc-dc|전원/i.test(text) ? "PMIC/DCDC" : "High-speed interface");
    addTag(tags, "Diagnostic Gate", "Function ON/OFF A/B");
  }

  if (/thermal|temperature|온도|고온|저온|발열/i.test(text)) {
    addTag(tags, "Thermal Sensitive", "True");
  }

  if (tags.some(tag => tag.key === "CA Combo") && tags.some(tag => tag.key === "Tx Correlated")) {
    addTag(tags, "Diagnostic Gate", "CA channel sweep + IM calculation");
    addTag(tags, "Desense Category", tags.some(tag => tag.key === "PIM Risk") ? "TX-induced PIM Desense" : "TX-induced Desense");
  }

  if (hasAny(text, [/contact\s*force/i, /접촉\s*압/i, /가압/i, /압력/i, /누름/i])) {
    addTag(tags, "Pressure Sensitive", "True");
    addTag(tags, "Diagnostic Gate", "Pressure A/B test");
  }

  if (hasAny(text, [/shield\s*can/i, /shield-can/i, /차폐\s*캔/i, /쉴드\s*캔/i])) {
    addTag(tags, "PIM Risk", "High");
    addTag(tags, "Contact Structure", "Shield Can");
    addTag(tags, "Contact Type", "Shield Can");
  }

  if (hasAny(text, [/reassembly/i, /re-assembly/i, /재\s*조립/i, /분해\s*후\s*조립/i])) {
    addTag(tags, "Reassembly Effect", "Disappears");
  }

  if (hasAny(text, [/conducted/i, /rf\s*cable/i, /cable\s*rx/i, /전도/i, /케이블/i])) {
    addTag(tags, "Conducted Result", /normal|pass|정상/i.test(text) ? "Normal" : "Check required");
  }

  if (hasAny(text, [/ota/i, /tis/i, /eis/i, /chamber/i, /방사/i, /챔버/i])) {
    addTag(tags, "OTA Result", /fail|ng|불량|저하/i.test(text) ? "Fail" : "Check required");
  }

  for (const aliasTag of resolveAliasesInText(text)) {
    addTag(tags, aliasTag.key, aliasTag.value);
  }

  return canonicalizeSignatures(tags);
}

export function mergeSignatures(base: SignatureTag[], additions: SignatureTag[]): SignatureTag[] {
  const merged = canonicalizeSignatures(base);
  for (const tag of canonicalizeSignatures(additions)) {
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

function buildMissingInfo(merged: SignatureTag[], text: string): string[] {
  const missing: string[] = [];
  if (!merged.some(tag => tag.key === "Tx Power")) missing.push("Tx power sweep 결과");
  if (!merged.some(tag => tag.key === "Conducted Result")) missing.push("Conducted RX baseline");
  if (!merged.some(tag => tag.key === "OTA Result")) missing.push("OTA TIS/EIS 또는 chamber 재현 결과");
  if (!merged.some(tag => tag.key === "IM Product") && /tx|ca|pim|송신|고출력/i.test(text)) missing.push("IM3/IM5 주파수 계산값");
  return missing;
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
}): LocalEvidencePacket {
  const extractedTags = extractRfSignatures(input.text);
  const merged = mergeSignatures(input.existingSignatures, extractedTags);
  const insight = classifyDesenseCase(merged, input.text);
  const missing = buildWeightedMissingInfo(merged, input.text, input.signatureWeightRules);
  const pendingAliasCandidates = findPendingAliasCandidates(input.text);
  const similarCases = findSimilarCases(merged, 20, 3, input.signatureWeightRules).map(item => ({
    id: item.id,
    title: item.title,
    similarity: item.similarity ?? 0,
  }));
  const evidence: LocalEvidenceItem[] = [
    ...extractedTags.map((tag, index) => ({
      id: `sig-${index + 1}`,
      type: "signature" as const,
      label: `${tag.key}=${tag.value}`,
      detail: "사용자 입력에서 local rule로 추출한 RF signature입니다.",
      source: "local-rule" as const,
      weight: getSignatureGroupWeight(tag.key, "analysis", input.signatureWeightRules) >= 4 ? "high" as const : "medium" as const,
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
    evidence,
  };
}

export function generateLocalRfReply(input: {
  text: string;
  existingSignatures: SignatureTag[];
  quotedSource?: string;
  attachments?: ChatAttachment[];
  signatureWeightRules?: SignatureWeightRule[];
}): { content: string; extractedTags: SignatureTag[]; evidencePacket: LocalEvidencePacket } {
  const extractedTags = extractRfSignatures(input.text);
  const merged = mergeSignatures(input.existingSignatures, extractedTags);
  const insight = classifyDesenseCase(merged, input.text);
  const similarCases = findSimilarCases(merged, 20, 2, input.signatureWeightRules);
  const missing: string[] = [];

  if (!merged.some(tag => tag.key === "Tx Power")) missing.push("Tx power sweep 결과");
  if (!merged.some(tag => tag.key === "Conducted Result")) missing.push("Conducted RX baseline");
  if (!merged.some(tag => tag.key === "OTA Result")) missing.push("OTA TIS/EIS 또는 chamber 재현 결과");
  if (!merged.some(tag => tag.key === "IM Product") && /tx|ca|pim|송신|고출력/i.test(input.text)) missing.push("IM3/IM5 주파수 계산값");

  const contextLine = input.quotedSource
    ? `인용하신 "${input.quotedSource}" 내용을 이전 분석 맥락으로 반영했습니다.`
    : "현재 채팅 입력과 기존 Signature를 함께 보았습니다.";

  const evidencePacket = buildLocalEvidencePacket(input);
  const displayMissing = evidencePacket.missingInfo;

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
      `부족 정보:\n${missing.length ? missing.map(item => `- ${item}`).join("\n") : "- 현재 입력 기준으로 핵심 분기 정보는 대부분 확보되었습니다."}`,
      "",
      similarCases.length
        ? `유사 사례: ${similarCases.map(item => `${item.id} ${item.title} (${item.similarity}%)`).join(" / ")}`
        : "유사 사례: 아직 충분히 가까운 사례가 없습니다. Signature를 더 보강하면 검색 품질이 올라갑니다.",
      "",
      `사용한 맥락: ${contextLine}`,
    ].join("\n"),
  };
}
