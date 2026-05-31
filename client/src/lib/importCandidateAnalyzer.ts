import { hasRfAnalysisIntent } from "@shared/rfFipRuleCatalog";
import { persistableAttachment } from "./attachmentPersistence";
import { readImportFile, type ParsedImportSource } from "./importParser";
import {
  buildAttachmentEvidence,
  buildLocalEvidencePacket,
  extractRfSignatures,
  type LocalEvidencePacket,
} from "./localRfAnalyzer";
import type { ChatAttachment, SignatureTag } from "./mockData";
import { classifyDesenseCase } from "./rfDesenseTaxonomy";
import {
  canonicalizeSignatureTag,
  normalizeAliasToken,
  type SignatureAliasEntry,
} from "./signatureAliasResolver";
import type { KnowledgeCase } from "./similarCasesDb";
import type { SignatureWeightRule } from "./signatureWeights";

export interface ImportCandidate {
  id: string;
  fileName: string;
  status: "candidate" | "hold";
  score: number;
  reasons: string[];
  evidenceSnippets: string[];
  importFacts: string[];
  statusDecision: ImportStatusDecision;
  localEvidencePacket?: LocalEvidencePacket;
  previewText: string;
  rawText: string;
  caseData: KnowledgeCase;
  materials: ChatAttachment[];
  duplicateMatch?: ImportDuplicateMatch;
}

export interface ImportStatusDecision {
  status: "candidate" | "hold";
  score: number;
  ruleIds: string[];
  explanation: string;
  facts: string[];
}

export interface ImportDuplicateMatch {
  duplicate: boolean;
  reason: string;
  matchedCaseId?: string;
  similarity?: number;
}

export interface ImportCandidateAnalyzerContext {
  signatureWeightRules?: SignatureWeightRule[];
  knowledgeCases?: KnowledgeCase[];
  signatureAliasDictionary?: SignatureAliasEntry[];
}

export function makeImportId(prefix: string, sequence = 0): string {
  return `${prefix}-${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCaseKey(item: Pick<KnowledgeCase, "title" | "band" | "confirmedRootCause">): string {
  return [item.title, item.band, item.confirmedRootCause]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function signatureKey(signature: SignatureTag, signatureAliasDictionary: SignatureAliasEntry[] = []): string {
  const canonical = canonicalizeSignatureTag(signature, signatureAliasDictionary);
  return `${normalizeAliasToken(canonical.key)}:${normalizeAliasToken(canonical.value)}`;
}

export function signatureSimilarity(
  a: SignatureTag[],
  b: SignatureTag[],
  signatureAliasDictionary: SignatureAliasEntry[] = [],
): number {
  const left = new Set(a.map(signature => signatureKey(signature, signatureAliasDictionary)));
  const right = new Set(b.map(signature => signatureKey(signature, signatureAliasDictionary)));
  if (!left.size && !right.size) return 0;
  let intersection = 0;
  for (const key of Array.from(left)) {
    if (right.has(key)) intersection += 1;
  }
  return intersection / new Set([...Array.from(left), ...Array.from(right)]).size;
}

export function findDuplicateImportCase(
  candidate: KnowledgeCase,
  existing: KnowledgeCase[],
  signatureAliasDictionary: SignatureAliasEntry[] = [],
): ImportDuplicateMatch {
  const normalizedCandidateKey = normalizeCaseKey(candidate);
  let best: ImportDuplicateMatch = { duplicate: false, reason: "No similar Knowledge DB case found." };

  for (const item of existing) {
    if (normalizeCaseKey(item) === normalizedCandidateKey) {
      return {
        duplicate: true,
        reason: "Same normalized title, band, and root cause.",
        matchedCaseId: item.id,
        similarity: 1,
      };
    }

    const similarity = signatureSimilarity(candidate.signatures, item.signatures, signatureAliasDictionary);
    const sameBand = candidate.band.toLowerCase() === item.band.toLowerCase();
    const rootCauseOverlap =
      candidate.confirmedRootCause.toLowerCase().includes(item.confirmedRootCause.toLowerCase()) ||
      item.confirmedRootCause.toLowerCase().includes(candidate.confirmedRootCause.toLowerCase());
    const titleOverlap =
      candidate.title.toLowerCase().includes(item.title.toLowerCase()) ||
      item.title.toLowerCase().includes(candidate.title.toLowerCase());

    const duplicate = (sameBand && similarity >= 0.55) || (similarity >= 0.7 && (rootCauseOverlap || titleOverlap));
    if (duplicate && similarity > (best.similarity ?? 0)) {
      best = {
        duplicate: true,
        reason: sameBand
          ? `Signature similarity ${(similarity * 100).toFixed(0)}% on the same band.`
          : `Signature similarity ${(similarity * 100).toFixed(0)}% with matching title/root-cause clue.`,
        matchedCaseId: item.id,
        similarity,
      };
    } else if (!best.duplicate && similarity > (best.similarity ?? 0)) {
      best = {
        duplicate: false,
        reason: `Closest signature similarity ${(similarity * 100).toFixed(0)}%.`,
        matchedCaseId: item.id,
        similarity,
      };
    }
  }

  return best;
}

function parseDelimitedRows(text: string, delimiter?: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean).slice(0, 12);
  const inferredDelimiter = delimiter ?? (lines.some(line => line.includes("\t")) ? "\t" : ",");
  return lines.map(line => line.split(inferredDelimiter).map(cell => cell.trim())).filter(row => row.length > 1);
}

export function attachEvidenceTrace(material: ChatAttachment): ChatAttachment {
  const evidence = buildAttachmentEvidence([material]).map(item => `${item.id}: ${item.detail}`);
  return evidence.length ? { ...material, evidence } : material;
}

function buildImportStatusDecision(input: {
  text: string;
  signatures: SignatureTag[];
  hasRfSignal: boolean;
  insightCategory: string;
  evidencePacket: LocalEvidencePacket;
}): ImportStatusDecision {
  const status: ImportStatusDecision["status"] = input.text && (input.hasRfSignal || input.signatures.length >= 2) ? "candidate" : "hold";
  const score = status === "candidate"
    ? Math.min(94, 42 + input.signatures.length * 6 + (input.hasRfSignal ? 18 : 0))
    : Math.min(35, 10 + input.signatures.length * 4);
  const facts = [
    `${input.signatures.length} extracted signature(s)`,
    `classification=${input.insightCategory}`,
    ...input.evidencePacket.evidence
      .filter(item => item.type === "attachment" || item.type === "classification")
      .slice(0, 4)
      .map(item => `${item.id}: ${item.detail}`),
    ...(input.evidencePacket.pendingAliasCandidates ?? [])
      .slice(0, 3)
      .map(item => `pending alias: ${item.raw} -> ${item.canonicalKey}:${item.canonicalValue} (${item.score})`),
  ];
  return {
    status,
    score,
    ruleIds: [
      input.hasRfSignal ? "rf-keyword-present" : "rf-keyword-missing",
      input.signatures.length >= 2 ? "signature-count-pass" : "signature-count-low",
    ],
    explanation: status === "candidate"
      ? "Deterministic local rules found enough RF signal for reviewer approval flow."
      : "Deterministic local rules did not find enough RF signal for automatic approval.",
    facts,
  };
}

export function buildImportCandidate(
  file: File,
  rawText: string,
  context: ImportCandidateAnalyzerContext = {},
): ImportCandidate {
  const { signatureWeightRules = [], knowledgeCases = [], signatureAliasDictionary = [] } = context;
  const text = rawText.trim();
  const signatures = extractRfSignatures(text, signatureAliasDictionary);
  const insight = classifyDesenseCase(signatures, text);
  const hasRfSignal = hasRfAnalysisIntent(text, 0);
  const status: ImportCandidate["status"] = text && (hasRfSignal || signatures.length >= 2) ? "candidate" : "hold";
  const score = status === "candidate"
    ? Math.min(94, 42 + signatures.length * 6 + (hasRfSignal ? 18 : 0))
    : Math.min(35, 10 + signatures.length * 4);
  const band = signatures.find(sig => sig.key.toLowerCase() === "band")?.value ?? "Unknown";
  const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0)?.trim();
  const reasons = status === "candidate"
    ? [
        `${signatures.length} RF signature(s) extracted.`,
        `Matched ${insight.category} local classification rule.`,
        hasRfSignal ? "RF keyword/measurement signal is present." : "Structured RF signature signal is present.",
      ]
    : [
        "Insufficient deterministic RF signal for automatic Knowledge DB approval.",
        "Keep this source on hold until a reviewer edits or promotes it.",
      ];
  const evidenceSnippets = text
    .split(/\r?\n/)
    .filter(line => hasRfAnalysisIntent(line, 0))
    .slice(0, 5);
  const rows = /\.(csv|tsv)$/i.test(file.name) ? parseDelimitedRows(text, file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",") : [];
  const material: ChatAttachment = rows.length >= 2
    ? { id: makeImportId("import-material"), type: "table", name: file.name, mimeType: file.type, size: file.size, rows }
    : {
        id: makeImportId("import-material"),
        type: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        mimeType: file.type,
        size: file.size,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
  const tracedMaterial = attachEvidenceTrace(material);
  const localEvidencePacket = buildLocalEvidencePacket({
    text,
    existingSignatures: [],
    attachments: [tracedMaterial],
    signatureWeightRules,
    knowledgeCases,
    signatureAliasDictionary,
  });
  const statusDecision = buildImportStatusDecision({
    text,
    signatures,
    hasRfSignal,
    insightCategory: insight.category,
    evidencePacket: localEvidencePacket,
  });

  return {
    id: makeImportId("import"),
    fileName: file.name,
    status,
    score,
    reasons,
    evidenceSnippets,
    importFacts: statusDecision.facts,
    statusDecision,
    localEvidencePacket,
    previewText: text.slice(0, 900),
    rawText: text,
    materials: [tracedMaterial],
    caseData: {
      id: `KB-LOCAL-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}`,
      title: firstLine ? firstLine.slice(0, 90) : `${file.name} import candidate`,
      model: "Import Review",
      band,
      status: "validated",
      confirmedRootCause: status === "candidate" ? `${insight.category} candidate: ${insight.mechanism}` : "Insufficient source analysis detail",
      mitigation: insight.actionGuide,
      symptomPattern: insight.symptomPattern,
      diagnosticTests: insight.diagnosticTests,
      suspectedStructures: insight.suspectedStructures,
      lessonsLearned: insight.lessonsLearned,
      decisionRationale: [...reasons, ...evidenceSnippets.map(snippet => `Source evidence: ${snippet}`)],
      usedMaterials: [persistableAttachment(tracedMaterial)],
      signatures,
    },
  };
}

export function refreshImportEvidence(
  candidate: ImportCandidate,
  text: string,
  materials: ChatAttachment[],
  context: ImportCandidateAnalyzerContext = {},
): ImportCandidate {
  const { signatureWeightRules = [], knowledgeCases = [], signatureAliasDictionary = [] } = context;
  const tracedMaterials = materials.map(attachEvidenceTrace);
  const packet = buildLocalEvidencePacket({
    text,
    existingSignatures: [],
    attachments: tracedMaterials,
    signatureWeightRules,
    knowledgeCases,
    signatureAliasDictionary,
  });
  const decision = buildImportStatusDecision({
    text,
    signatures: candidate.caseData.signatures,
    hasRfSignal: candidate.status === "candidate",
    insightCategory: classifyDesenseCase(candidate.caseData.signatures, text).category,
    evidencePacket: packet,
  });
  const statusDecision = { ...decision, status: candidate.status, score: candidate.score };
  return {
    ...candidate,
    importFacts: statusDecision.facts,
    statusDecision,
    localEvidencePacket: packet,
    materials: tracedMaterials,
    caseData: {
      ...candidate.caseData,
      usedMaterials: tracedMaterials.map(persistableAttachment),
      decisionRationale: [
        ...candidate.reasons,
        ...candidate.evidenceSnippets.map(snippet => `Source evidence: ${snippet}`),
        ...statusDecision.facts.map(fact => `Local fact: ${fact}`),
      ],
    },
  };
}

export function buildImportCandidatesFromSources(
  file: File,
  sources: ParsedImportSource[],
  offset = 0,
  context: ImportCandidateAnalyzerContext = {},
): ImportCandidate[] {
  return sources.map((source, index) => {
    const sequence = offset + index;
    const base = buildImportCandidate(file, source.text, context);
    return refreshImportEvidence({
      ...base,
      id: makeImportId("import", sequence),
      fileName: `${file.name} #${index + 1}`,
      previewText: source.text.slice(0, 900),
      rawText: source.text,
      caseData: {
        ...base.caseData,
        id: `KB-LOCAL-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${String(sequence + 1).padStart(2, "0")}`,
        title: (source.title || base.caseData.title).slice(0, 90),
      },
    }, source.text, source.materials, context);
  });
}

export async function buildImportCandidatesFromFiles(
  files: File[],
  context: ImportCandidateAnalyzerContext = {},
): Promise<ImportCandidate[]> {
  const candidateGroups = await Promise.all(files.map(async (file, fileIndex) => {
    const sources = await readImportFile(file);
    return buildImportCandidatesFromSources(file, sources, fileIndex * 100, context);
  }));
  return candidateGroups.flat().map(candidate => ({
    ...candidate,
    duplicateMatch: findDuplicateImportCase(candidate.caseData, context.knowledgeCases ?? [], context.signatureAliasDictionary ?? []),
  }));
}
