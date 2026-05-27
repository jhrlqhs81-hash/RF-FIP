import type { EvidenceItem, Hypothesis } from "./mockData";
import type { LocalEvidenceItem, LocalEvidencePacket } from "./localRfAnalyzer";

export interface HybridHypothesisCandidate {
  id: string;
  title: string;
  confidence: number;
  supportingEvidenceIds: string[];
  rejectedEvidenceIds: string[];
  mechanism: string;
  nextActions: string[];
  missingInfo: string[];
  source: "local-rule" | "llm";
}

export function validateHybridHypothesisCandidate(
  candidate: HybridHypothesisCandidate,
  packet: LocalEvidencePacket,
): string[] {
  const evidenceIds = new Set(packet.evidence.map(item => item.id));
  const errors: string[] = [];

  if (!candidate.title.trim()) errors.push("title is required");
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 100) {
    errors.push("confidence must be between 0 and 100");
  }
  for (const id of [...candidate.supportingEvidenceIds, ...candidate.rejectedEvidenceIds]) {
    if (!evidenceIds.has(id)) errors.push(`unknown evidence id: ${id}`);
  }
  if (!candidate.mechanism.trim()) errors.push("mechanism is required");
  return errors;
}

function evidenceWeight(item: LocalEvidenceItem): "high" | "medium" | "low" {
  if (item.type === "classification" || item.type === "rationale") return "high";
  return item.weight;
}

function toEvidenceItem(item: LocalEvidenceItem): EvidenceItem {
  return {
    type: item.type === "similar_case" ? "similar_case" : item.type === "missing_info" ? "rejected" : item.type === "attachment" ? "observation" : item.type === "diagnostic_test" ? "rule" : "rule",
    label: item.label,
    detail: item.detail,
    source: item.source,
    weight: evidenceWeight(item),
  };
}

export function candidateToHypothesis(
  candidate: HybridHypothesisCandidate,
  packet: LocalEvidencePacket,
): Hypothesis {
  const validationErrors = validateHybridHypothesisCandidate(candidate, packet);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid hybrid hypothesis: ${validationErrors.join(", ")}`);
  }

  const byId = new Map(packet.evidence.map(item => [item.id, item]));
  const supporting = candidate.supportingEvidenceIds.flatMap(id => {
    const item = byId.get(id);
    return item ? [toEvidenceItem(item)] : [];
  });
  const rejected = candidate.rejectedEvidenceIds.flatMap(id => {
    const item = byId.get(id);
    return item ? [{ ...toEvidenceItem(item), type: "rejected" as const }] : [];
  });

  return {
    id: candidate.id,
    title: candidate.title,
    confidence: candidate.confidence,
    mechanism: candidate.mechanism,
    reasons: [
      ...supporting.slice(0, 4).map(item => ({ type: "up" as const, text: item.label })),
      ...candidate.missingInfo.slice(0, 2).map(item => ({ type: "down" as const, text: `부족 정보: ${item}` })),
    ],
    evidence: [...supporting, ...rejected],
    nextActions: candidate.nextActions,
    status: candidate.confidence >= 75 ? "validated" : "active",
    source: candidate.source === "llm" ? "llm" : "local-rule",
  };
}

export function buildLocalHybridHypotheses(packet: LocalEvidencePacket): Hypothesis[] {
  const supportIds = packet.evidence
    .filter(item => item.type === "classification" || item.type === "rationale" || item.type === "similar_case" || item.type === "attachment")
    .map(item => item.id);
  const rejectedIds = packet.evidence
    .filter(item => item.type === "missing_info")
    .map(item => item.id);

  const confidence = Math.min(90, 45 + supportIds.length * 6 - Math.min(rejectedIds.length, 3) * 4);
  const candidate: HybridHypothesisCandidate = {
    id: `hyp-${packet.classification.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local"}`,
    title: packet.classification,
    confidence,
    supportingEvidenceIds: supportIds,
    rejectedEvidenceIds: rejectedIds,
    mechanism: packet.mechanism,
    nextActions: packet.diagnosticTests,
    missingInfo: packet.missingInfo,
    source: "local-rule",
  };

  return [candidateToHypothesis(candidate, packet)];
}
