import { ChatAttachment, SignatureTag } from "./mockData";
import { canonicalizeSignatureTag, type SignatureAliasEntry } from "./signatureAliasResolver";
import { signatureConceptComparable } from "./signatureConceptRegistry";
import { getSignatureTagGroupWeight, type SignatureWeightRule } from "./signatureWeights";

// ─── Knowledge DB (Confirmed RCA 사례) ───────────────────────────
export interface KnowledgeCase {
  id: string;
  title: string;
  model: string;
  band: string;
  status: 'confirmed' | 'validated';
  confirmedRootCause: string;
  mitigation: string;
  symptomPattern?: string;
  diagnosticTests?: string[];
  suspectedStructures?: string[];
  lessonsLearned?: string;
  decisionRationale?: string[];
  usedMaterials?: ChatAttachment[];
  signatures: SignatureTag[];
  similarity?: number; // 0~100, 계산 후 주입
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

export function calcSimilarity(current: SignatureTag[], target: KnowledgeCase, signatureWeightRules?: SignatureWeightRule[], signatureAliasDictionary?: SignatureAliasEntry[]): number {
  if (current.length === 0) return 0;

  let matchScore = 0;
  let totalWeight = 0;


  // current 기준으로 target과 매칭
  for (const cur of current) {
    const curKey = signatureKeyComparable(cur, signatureAliasDictionary);
    const w = getSignatureTagGroupWeight(cur, "retrieval", signatureWeightRules);
    totalWeight += w;

    // 키 일치 여부 확인 (대소문자 무시)
    const targetTags = target.signatures.filter(
      t => signatureKeyComparable(t, signatureAliasDictionary).toLowerCase() === curKey.toLowerCase()
    );
    if (targetTags.length === 0) continue;
    const targetTag = targetTags.reduce((best, item) =>
      conceptAwareValueMatchScore(cur, item, signatureAliasDictionary) > conceptAwareValueMatchScore(cur, best, signatureAliasDictionary) ? item : best
    );

    // 값 일치 여부 (부분 일치 포함)
    const curVal = signatureValueComparable(cur, signatureAliasDictionary);
    const tgtVal = signatureValueComparable(targetTag, signatureAliasDictionary);

    if (curVal === tgtVal) {
      matchScore += w; // 완전 일치
    } else if (curVal.includes(tgtVal) || tgtVal.includes(curVal)) {
      matchScore += w * 0.6; // 부분 일치
    } else {
      // 키만 일치 (값 불일치) — 부분 점수
      matchScore += w * 0.1;
    }
  }

  // target 기준으로 current에 없는 중요 키 패널티
  for (const tgt of target.signatures) {
    const tgtKey = signatureKeyComparable(tgt, signatureAliasDictionary);
    const w = getSignatureTagGroupWeight(tgt, "retrieval", signatureWeightRules);
    const hasKey = current.some(c => signatureKeyComparable(c, signatureAliasDictionary).toLowerCase() === tgtKey.toLowerCase());
    if (!hasKey) {
      totalWeight += w * 0.3; // 없는 키는 낮은 가중치로 분모에만 추가
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((matchScore / totalWeight) * 100);
}

/**
 * 현재 Signature 배열에 대해 유사 사례를 찾아 유사도 순으로 반환합니다.
 * @param current 현재 이슈의 Signature 배열
 * @param threshold 최소 유사도 (기본 20%)
 * @param limit 최대 반환 개수 (기본 4)
 */
export function findSimilarCases(
  current: SignatureTag[],
  threshold = 20,
  limit = 4,
  signatureWeightRules?: SignatureWeightRule[],
  knowledgeCases: KnowledgeCase[] = [],
  signatureAliasDictionary?: SignatureAliasEntry[],
): KnowledgeCase[] {
  return knowledgeCases
    .map(kc => ({ ...kc, similarity: calcSimilarity(current, kc, signatureWeightRules, signatureAliasDictionary) }))
    .filter(kc => (kc.similarity ?? 0) >= threshold)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit);
}
