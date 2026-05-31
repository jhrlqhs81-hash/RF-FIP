import { ChatAttachment, SignatureTag } from "./mockData";
import { canonicalizeSignatureTag, type SignatureAliasEntry } from "./signatureAliasResolver";
import { signatureConceptComparable } from "./signatureConceptRegistry";
import { getSignatureTagGroupWeight, type SignatureWeightRule } from "./signatureWeights";
import { getBandValue, splitSignatureTags } from "./signatureTagGroups";

export type BandMatch = "same" | "different" | "unknown";

export interface BandComparison {
  current?: string;
  target?: string;
  effect: number;
}

export interface KnowledgeCase {
  id: string;
  title: string;
  model: string;
  band: string;
  status: "confirmed" | "validated";
  confirmedRootCause: string;
  mitigation: string;
  symptomPattern?: string;
  diagnosticTests?: string[];
  suspectedStructures?: string[];
  lessonsLearned?: string;
  decisionRationale?: string[];
  usedMaterials?: ChatAttachment[];
  signatures: SignatureTag[];
  similarity?: number;
  bandMatch?: BandMatch;
  bandComparison?: BandComparison;
}

export interface SimilarityOptions {
  currentBand?: string;
}

function signatureKeyComparable(tag: SignatureTag, signatureAliasDictionary?: SignatureAliasEntry[]): string {
  return signatureConceptComparable(canonicalizeSignatureTag(tag, signatureAliasDictionary)).key;
}

function signatureValueComparable(tag: SignatureTag, signatureAliasDictionary?: SignatureAliasEntry[]): string {
  return signatureConceptComparable(canonicalizeSignatureTag(tag, signatureAliasDictionary)).value;
}

function conceptAwareValueMatchScore(current: SignatureTag, target: SignatureTag, signatureAliasDictionary?: SignatureAliasEntry[]): number {
  const curVal = signatureValueComparable(current, signatureAliasDictionary);
  const tgtVal = signatureValueComparable(target, signatureAliasDictionary);
  if (curVal === tgtVal) return 1;
  if (curVal.includes(tgtVal) || tgtVal.includes(curVal)) return 0.6;
  return 0.1;
}

function normalizeBand(value?: string): string | undefined {
  const normalized = value?.normalize("NFKC").toLowerCase().replace(/\s+/g, "").trim();
  if (!normalized || normalized === "-") return undefined;
  return normalized.replace(/^lte/, "").replace(/^nr/, "");
}

function getCaseBand(target: KnowledgeCase): string | undefined {
  return getBandValue(target.signatures, target.band);
}

function buildBandComparison(current: SignatureTag[], target: KnowledgeCase, options?: SimilarityOptions): {
  match: BandMatch;
  comparison: BandComparison;
} {
  const currentBand = getBandValue(current, options?.currentBand);
  const targetBand = getCaseBand(target);
  const normalizedCurrent = normalizeBand(currentBand);
  const normalizedTarget = normalizeBand(targetBand);
  if (!normalizedCurrent || !normalizedTarget) {
    return {
      match: "unknown",
      comparison: { current: currentBand, target: targetBand, effect: 0 },
    };
  }
  if (normalizedCurrent === normalizedTarget) {
    return {
      match: "same",
      comparison: { current: currentBand, target: targetBand, effect: 6 },
    };
  }
  return {
    match: "different",
    comparison: { current: currentBand, target: targetBand, effect: -6 },
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calcSimilarity(
  current: SignatureTag[],
  target: KnowledgeCase,
  signatureWeightRules?: SignatureWeightRule[],
  signatureAliasDictionary?: SignatureAliasEntry[],
  options?: SimilarityOptions,
): number {
  const currentAnalysis = splitSignatureTags(current).analysisSignatures;
  const targetAnalysis = splitSignatureTags(target.signatures).analysisSignatures;
  if (currentAnalysis.length === 0) return 0;

  let matchScore = 0;
  let totalWeight = 0;

  for (const cur of currentAnalysis) {
    const curKey = signatureKeyComparable(cur, signatureAliasDictionary);
    const weight = getSignatureTagGroupWeight(cur, "retrieval", signatureWeightRules);
    totalWeight += weight;

    const targetTags = targetAnalysis.filter(
      item => signatureKeyComparable(item, signatureAliasDictionary).toLowerCase() === curKey.toLowerCase()
    );
    if (targetTags.length === 0) continue;

    const targetTag = targetTags.reduce((best, item) =>
      conceptAwareValueMatchScore(cur, item, signatureAliasDictionary) >
      conceptAwareValueMatchScore(cur, best, signatureAliasDictionary) ? item : best
    );

    const currentValue = signatureValueComparable(cur, signatureAliasDictionary);
    const targetValue = signatureValueComparable(targetTag, signatureAliasDictionary);

    if (currentValue === targetValue) matchScore += weight;
    else if (currentValue.includes(targetValue) || targetValue.includes(currentValue)) matchScore += weight * 0.6;
    else matchScore += weight * 0.1;
  }

  for (const targetTag of targetAnalysis) {
    const targetKey = signatureKeyComparable(targetTag, signatureAliasDictionary);
    const weight = getSignatureTagGroupWeight(targetTag, "retrieval", signatureWeightRules);
    const hasKey = currentAnalysis.some(item =>
      signatureKeyComparable(item, signatureAliasDictionary).toLowerCase() === targetKey.toLowerCase()
    );
    if (!hasKey) totalWeight += weight * 0.3;
  }

  if (totalWeight === 0) return 0;
  const baseScore = (matchScore / totalWeight) * 100;
  const band = buildBandComparison(current, target, options);
  return clampScore(baseScore + band.comparison.effect);
}

export function findSimilarCases(
  current: SignatureTag[],
  threshold = 20,
  limit = 4,
  signatureWeightRules?: SignatureWeightRule[],
  knowledgeCases: KnowledgeCase[] = [],
  signatureAliasDictionary?: SignatureAliasEntry[],
  options?: SimilarityOptions,
): KnowledgeCase[] {
  return knowledgeCases
    .map(kc => {
      const band = buildBandComparison(current, kc, options);
      return {
        ...kc,
        similarity: calcSimilarity(current, kc, signatureWeightRules, signatureAliasDictionary, options),
        bandMatch: band.match,
        bandComparison: band.comparison,
      };
    })
    .filter(kc => (kc.similarity ?? 0) >= threshold)
    .sort((a, b) => {
      const scoreDelta = (b.similarity ?? 0) - (a.similarity ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      if (a.bandMatch === b.bandMatch) return 0;
      if (a.bandMatch === "same") return -1;
      if (b.bandMatch === "same") return 1;
      return 0;
    })
    .slice(0, limit);
}
