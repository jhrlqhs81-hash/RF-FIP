import type { SignatureTag } from "./mockData";

export type SignatureTagGroup = "analysis" | "metadata" | "narrative";

export interface SplitSignatureTags {
  analysisSignatures: SignatureTag[];
  metadataTags: SignatureTag[];
  narrativeTags: SignatureTag[];
}

const METADATA_KEYS = new Set([
  "rat",
  "band",
  "band dl",
  "band ul",
  "degradation",
  "degradation (db)",
  "unit scope",
  "tx threshold",
]);

const NARRATIVE_KEYS = new Set([
  "mechanism",
  "desense category",
  "pim risk",
  "thermal sensitive",
  "thermal dependent",
  "surface condition",
  "thb history",
  "temporal pattern",
  "mechanical stress",
  "drop history",
  "onset condition",
]);

export function normalizeSignatureKey(key: string): string {
  return key.normalize("NFKC").trim().toLowerCase();
}

export function isMetadataSignature(tag: Pick<SignatureTag, "key">): boolean {
  return METADATA_KEYS.has(normalizeSignatureKey(tag.key));
}

export function isNarrativeSignature(tag: Pick<SignatureTag, "key">): boolean {
  return NARRATIVE_KEYS.has(normalizeSignatureKey(tag.key));
}

export function getSignatureTagGroup(tag: Pick<SignatureTag, "key">): SignatureTagGroup {
  if (isMetadataSignature(tag)) return "metadata";
  if (isNarrativeSignature(tag)) return "narrative";
  return "analysis";
}

export function splitSignatureTags(tags: SignatureTag[]): SplitSignatureTags {
  const result: SplitSignatureTags = {
    analysisSignatures: [],
    metadataTags: [],
    narrativeTags: [],
  };

  for (const tag of tags) {
    const group = getSignatureTagGroup(tag);
    if (group === "metadata") result.metadataTags.push(tag);
    else if (group === "narrative") result.narrativeTags.push(tag);
    else result.analysisSignatures.push(tag);
  }

  return result;
}

export function findSignatureValue(tags: SignatureTag[], key: string): string | undefined {
  const comparableKey = normalizeSignatureKey(key);
  return tags.find(tag => normalizeSignatureKey(tag.key) === comparableKey)?.value;
}

export function getBandValue(tags: SignatureTag[], fallbackBand?: string): string | undefined {
  return findSignatureValue(tags, "Band") ?? fallbackBand;
}
