import type { ChatSummary, SummaryItem } from "./mockData";
import type { LocalEvidenceItem, LocalEvidencePacket } from "./localRfAnalyzer";

export interface GroundedNextStep {
  text: string;
  rationale: string;
  evidence: string[];
  messageId: string;
}

export interface HybridSummaryDraft {
  keyFindings: SummaryItem[];
  confirmedFacts: SummaryItem[];
  pendingQuestions: SummaryItem[];
  nextSteps: GroundedNextStep[];
}

function itemText(item: SummaryItem): string {
  return typeof item === "string" ? item : item.text;
}

function evidenceLabel(item: LocalEvidenceItem): string {
  return `${item.id}: ${item.label}`;
}

function toSummaryItem(text: string, messageId: string, evidence: LocalEvidenceItem[], rationale: string): SummaryItem {
  return {
    text,
    messageId,
    rationale,
    evidence: evidence.map(evidenceLabel),
  };
}

export function validateGroundedSummary(summary: ChatSummary): string[] {
  const errors: string[] = [];
  for (let index = 0; index < summary.nextSteps.length; index += 1) {
    const item = summary.nextSteps[index];
    if (typeof item === "string") {
      errors.push(`nextSteps[${index}] must be an object`);
      continue;
    }
    if (!item.text.trim()) errors.push(`nextSteps[${index}].text is required`);
    if (!item.rationale?.trim()) errors.push(`nextSteps[${index}].rationale is required`);
    if (!item.messageId?.trim()) errors.push(`nextSteps[${index}].messageId is required`);
    if (!item.evidence?.length) errors.push(`nextSteps[${index}].evidence is required`);
  }
  return errors;
}

export function buildLocalHybridSummary(input: {
  packet: LocalEvidencePacket;
  messageId: string;
  previousSummary?: ChatSummary;
  timestamp: string;
}): ChatSummary {
  const highSignal = input.packet.evidence.filter(item => item.weight === "high");
  const classificationEvidence = input.packet.evidence.filter(item => item.type === "classification" || item.type === "rationale");
  const missingEvidence = input.packet.evidence.filter(item => item.type === "missing_info");
  const attachmentEvidence = input.packet.evidence.filter(item => item.type === "attachment");
  const testEvidence = input.packet.evidence.filter(item => item.type === "diagnostic_test");

  const keyFindings = [
    toSummaryItem(
      `${input.packet.classification}: ${input.packet.mechanism}`,
      input.messageId,
      classificationEvidence.slice(0, 3),
      "Local taxonomy classification and rationale were generated from the current message signatures.",
    ),
    ...attachmentEvidence.slice(0, 2).map(item =>
      toSummaryItem(item.detail, input.messageId, [item], "Attachment metadata or parsed table rows were included as supporting context.")
    ),
  ];

  const confirmedFacts = input.packet.mergedSignatures.slice(0, 5).map(tag =>
    toSummaryItem(`${tag.key}: ${tag.value}`, input.messageId, highSignal.slice(0, 2), "Confirmed as deterministic local signature state.")
  );

  const pendingQuestions = missingEvidence.length
    ? missingEvidence.map(item => toSummaryItem(item.detail, input.messageId, [item], "Required RF discriminator is not present in the current evidence packet."))
    : [toSummaryItem("No critical missing discriminator was detected by the local evidence packet.", input.messageId, classificationEvidence.slice(0, 1), "Local required-field checks did not find a missing gate.")];

  const nextSteps = testEvidence.slice(0, 4).map(item => ({
    text: item.detail,
    messageId: input.messageId,
    rationale: `Recommended because ${input.packet.classification} remains the active local classification.`,
    evidence: [evidenceLabel(item), ...classificationEvidence.slice(0, 1).map(evidenceLabel)],
  }));

  const summary: ChatSummary = {
    keyFindings: keyFindings.length ? keyFindings : input.previousSummary?.keyFindings ?? [],
    confirmedFacts: confirmedFacts.length ? confirmedFacts : input.previousSummary?.confirmedFacts ?? [],
    pendingQuestions,
    nextSteps: nextSteps.length ? nextSteps : input.previousSummary?.nextSteps ?? [],
    lastUpdated: input.timestamp,
    source: "local-rule",
  };

  const errors = validateGroundedSummary(summary);
  if (errors.length > 0 && input.previousSummary) {
    return input.previousSummary;
  }
  return summary;
}

export function summaryContainsText(summary: ChatSummary, text: string): boolean {
  const all = [...summary.keyFindings, ...summary.confirmedFacts, ...summary.pendingQuestions, ...summary.nextSteps];
  return all.some(item => itemText(item).includes(text));
}
