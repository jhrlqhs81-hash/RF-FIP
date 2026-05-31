import type { SignatureTag } from "./mockData";
import { normalizeSignatureKeyComparable } from "./signatureAliasResolver";
import {
  describeSignatureConcept,
  resolveSignatureConceptKey,
  signatureConceptKeyComparable,
} from "./signatureConceptRegistry";

export interface SignatureWeightRule {
  id: string;
  signatureKey: string;
  analysisWeight: number;
  retrievalWeight: number;
  workflowWeight: number;
  enabled: boolean;
  reason: string;
  operationRule: string;
  updatedAt: string;
}

export const DEFAULT_SIGNATURE_WEIGHT = 3;

const DEFAULT_UPDATED_AT = "2026-05-27T00:00:00.000Z";

export const DEFAULT_SIGNATURE_WEIGHT_RULES: SignatureWeightRule[] = [
  {
    id: "sig-weight-tx-correlated",
    signatureKey: "Tx Correlated",
    analysisWeight: 5,
    retrievalWeight: 4,
    workflowWeight: 5,
    enabled: true,
    reason: "Tx 연동 여부는 RF desense 원인 분기와 다음 시험을 좌우하는 핵심 gate입니다.",
    operationRule: "Tx ON/OFF 결과가 명확하면 높게 유지하고, 추정 언급이면 낮춥니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-conducted-result",
    signatureKey: "Conducted Result",
    analysisWeight: 5,
    retrievalWeight: 3,
    workflowWeight: 5,
    enabled: true,
    reason: "Conducted baseline은 RF path와 OTA/antenna path 문제를 분리합니다.",
    operationRule: "Baseline 측정 신뢰도가 낮으면 analysisWeight를 낮추고 workflowWeight는 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-ota-result",
    signatureKey: "OTA Result",
    analysisWeight: 5,
    retrievalWeight: 3,
    workflowWeight: 5,
    enabled: true,
    reason: "OTA 재현 여부는 antenna, 구조물, 방사 경로 판단에 직접 연결됩니다.",
    operationRule: "Chamber 조건이 불완전하면 analysisWeight를 낮추고 checklist 우선순위는 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-im-product",
    signatureKey: "IM Product",
    analysisWeight: 5,
    retrievalWeight: 4,
    workflowWeight: 4,
    enabled: true,
    reason: "IM3/IM5 또는 harmonic overlap은 PIM/Tx-induced desense 판단에 강한 단서입니다.",
    operationRule: "주파수 계산 또는 spectrum evidence가 있을 때만 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-desense-category",
    signatureKey: "Desense Category",
    analysisWeight: 5,
    retrievalWeight: 4,
    workflowWeight: 3,
    enabled: true,
    reason: "분류 결과 자체이므로 분석 판단과 사례 검색에 강하게 작동합니다.",
    operationRule: "Local rule 추정만 있으면 analysisWeight를 낮추고, 확정 RCA에서는 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-mechanism",
    signatureKey: "Mechanism",
    analysisWeight: 5,
    retrievalWeight: 4,
    workflowWeight: 3,
    enabled: true,
    reason: "물리 메커니즘은 가설과 RCA Summary의 핵심 설명 축입니다.",
    operationRule: "Mechanism이 구체적이면 높게, 일반 표현이면 낮춥니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-diagnostic-gate",
    signatureKey: "Diagnostic Gate",
    analysisWeight: 4,
    retrievalWeight: 3,
    workflowWeight: 5,
    enabled: true,
    reason: "다음 분석 단계와 누락항목을 직접 결정합니다.",
    operationRule: "실행 가능한 gate이면 workflowWeight를 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-tx-power",
    signatureKey: "Tx Power",
    analysisWeight: 4,
    retrievalWeight: 3,
    workflowWeight: 5,
    enabled: true,
    reason: "Power sweep 조건은 Tx-induced 여부와 재현 조건을 분리합니다.",
    operationRule: "정량 sweep 값이면 높게, 단순 고출력 언급이면 중간으로 둡니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-ca-combo",
    signatureKey: "CA Combo",
    analysisWeight: 4,
    retrievalWeight: 4,
    workflowWeight: 4,
    enabled: true,
    reason: "CA 조합은 IM/harmonic 계산과 channel sweep에 중요합니다.",
    operationRule: "실제 fail 조합이면 높게, 가능성 언급이면 낮춥니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-contact-structure",
    signatureKey: "Contact Structure",
    analysisWeight: 4,
    retrievalWeight: 5,
    workflowWeight: 3,
    enabled: true,
    reason: "구조물 종류는 Knowledge DB 유사사례 매칭에서 강한 식별자입니다.",
    operationRule: "부품명/위치가 구체적이면 높이고, 일반 contact 언급이면 낮춥니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-contact-type",
    signatureKey: "Contact Type",
    analysisWeight: 4,
    retrievalWeight: 5,
    workflowWeight: 3,
    enabled: true,
    reason: "접촉 타입은 구조/조립 계열 사례 재사용에 강하게 작동합니다.",
    operationRule: "확정된 접촉 구조일 때 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-noise-source",
    signatureKey: "Noise Source",
    analysisWeight: 4,
    retrievalWeight: 5,
    workflowWeight: 3,
    enabled: true,
    reason: "MIPI, PMIC, DCDC 같은 source는 내부 spur/EMI 사례 매칭에 중요합니다.",
    operationRule: "ON/OFF A/B로 확인된 source면 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-pressure-sensitive",
    signatureKey: "Pressure Sensitive",
    analysisWeight: 4,
    retrievalWeight: 4,
    workflowWeight: 4,
    enabled: true,
    reason: "압력 민감도는 접촉/PIM 계열 판단과 검증 시험에 모두 중요합니다.",
    operationRule: "재현성 있는 pressure A/B 결과면 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-reassembly-effect",
    signatureKey: "Reassembly Effect",
    analysisWeight: 4,
    retrievalWeight: 4,
    workflowWeight: 3,
    enabled: true,
    reason: "재조립 후 사라짐은 접촉/조립 원인에 강한 단서입니다.",
    operationRule: "재조립 효과가 반복 확인되면 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-band",
    signatureKey: "Band",
    analysisWeight: 2,
    retrievalWeight: 4,
    workflowWeight: 2,
    enabled: true,
    reason: "Band는 단독 원인분류력은 낮지만 사례 검색 조건에는 중요합니다.",
    operationRule: "특정 band 반복 발생 패턴이 있으면 retrievalWeight를 높입니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-degradation-db",
    signatureKey: "Degradation (dB)",
    analysisWeight: 3,
    retrievalWeight: 3,
    workflowWeight: 2,
    enabled: true,
    reason: "열화량은 심각도 판단에 유용하지만 원인 특정력은 중간입니다.",
    operationRule: "측정 편차가 크면 낮추고 재현성이 좋으면 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-desense-type",
    signatureKey: "Desense Type",
    analysisWeight: 3,
    retrievalWeight: 3,
    workflowWeight: 2,
    enabled: true,
    reason: "증상 유형은 분석 보조 단서입니다.",
    operationRule: "Narrow/Broadband처럼 구체적이면 높이고 일반 증상이면 낮춥니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-tx-dependency",
    signatureKey: "Tx Dependency",
    analysisWeight: 4,
    retrievalWeight: 3,
    workflowWeight: 4,
    enabled: true,
    reason: "Tx dependency는 원인 분기와 다음 시험을 함께 좌우합니다.",
    operationRule: "Tx independent/correlated가 시험으로 확인되면 높게 유지합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-thermal-sensitive",
    signatureKey: "Thermal Sensitive",
    analysisWeight: 3,
    retrievalWeight: 3,
    workflowWeight: 3,
    enabled: true,
    reason: "온도 조건성은 원인 보조와 재현 조건 관리에 유용합니다.",
    operationRule: "Thermal sweep 결과가 있으면 높이고 단순 고온 언급이면 중간으로 둡니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-drop-history",
    signatureKey: "Drop History",
    analysisWeight: 3,
    retrievalWeight: 3,
    workflowWeight: 3,
    enabled: true,
    reason: "Drop 이력은 기구/접촉 stress 보조 단서입니다.",
    operationRule: "Drop 직후 재현이면 높이고 과거 이력만 있으면 낮춥니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
  {
    id: "sig-weight-mechanical-stress",
    signatureKey: "Mechanical Stress",
    analysisWeight: 3,
    retrievalWeight: 3,
    workflowWeight: 3,
    enabled: true,
    reason: "기구 stress 조건은 구조 원인 검증의 보조 단서입니다.",
    operationRule: "Stress 조건과 fail onset이 직접 연결되면 높입니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  },
];

function clampWeight(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SIGNATURE_WEIGHT;
  return Math.max(0, Math.min(5, Math.round(parsed)));
}

function normalizeRule(rule: SignatureWeightRule): SignatureWeightRule {
  return {
    ...rule,
    analysisWeight: clampWeight(rule.analysisWeight),
    retrievalWeight: clampWeight(rule.retrievalWeight),
    workflowWeight: clampWeight(rule.workflowWeight),
    enabled: rule.enabled !== false,
  };
}

export function mergeSignatureWeightRules(persisted: SignatureWeightRule[] = []): SignatureWeightRule[] {
  const byKey = new Map<string, SignatureWeightRule>();
  for (const rule of DEFAULT_SIGNATURE_WEIGHT_RULES) {
    const normalizedKey = signatureConceptKeyComparable(rule.signatureKey).toLowerCase();
    const existing = byKey.get(normalizedKey);
    const conceptKey = resolveSignatureConceptKey(rule.signatureKey)?.key;
    const incomingIsPrimary = conceptKey
      ? normalizeSignatureKeyComparable(conceptKey).toLowerCase() === normalizeSignatureKeyComparable(rule.signatureKey).toLowerCase()
      : true;
    const existingConceptKey = existing ? resolveSignatureConceptKey(existing.signatureKey)?.key : undefined;
    const existingIsPrimary = existing && existingConceptKey
      ? normalizeSignatureKeyComparable(existingConceptKey).toLowerCase() === normalizeSignatureKeyComparable(existing.signatureKey).toLowerCase()
      : !!existing;
    if (!existing || incomingIsPrimary || !existingIsPrimary) {
      byKey.set(normalizedKey, normalizeRule(rule));
    }
  }
  for (const rule of persisted) {
    if (!rule?.signatureKey) continue;
    const normalizedKey = signatureConceptKeyComparable(rule.signatureKey).toLowerCase();
    const base = byKey.get(normalizedKey);
    byKey.set(normalizedKey, normalizeRule({
      ...(base ?? {
        id: `sig-weight-${normalizedKey || Date.now()}`,
        signatureKey: rule.signatureKey,
        reason: "Custom signature key입니다.",
        operationRule: "운영자가 분석/검색/워크플로우 목적별 중요도를 직접 관리합니다.",
        updatedAt: new Date().toISOString(),
      }),
      ...rule,
      signatureKey: rule.signatureKey || base?.signatureKey || normalizedKey,
    } as SignatureWeightRule));
  }
  return Array.from(byKey.values()).sort((a, b) => a.signatureKey.localeCompare(b.signatureKey));
}

export function getSignatureWeightRule(signatureKey: string, rules: SignatureWeightRule[] = DEFAULT_SIGNATURE_WEIGHT_RULES): SignatureWeightRule {
  const normalizedKey = signatureConceptKeyComparable(signatureKey).toLowerCase();
  const match = mergeSignatureWeightRules(rules).find(rule =>
    signatureConceptKeyComparable(rule.signatureKey).toLowerCase() === normalizedKey
  );
  return match ?? {
    id: `sig-weight-${normalizedKey}`,
    signatureKey,
    analysisWeight: DEFAULT_SIGNATURE_WEIGHT,
    retrievalWeight: DEFAULT_SIGNATURE_WEIGHT,
    workflowWeight: DEFAULT_SIGNATURE_WEIGHT,
    enabled: true,
    reason: "기본 Signature key입니다.",
    operationRule: "명시 규칙이 없으면 3/3/3 일반 단서로 운영합니다.",
    updatedAt: DEFAULT_UPDATED_AT,
  };
}

export function getSignatureWeightRuleForTag(signature: SignatureTag, rules: SignatureWeightRule[] = DEFAULT_SIGNATURE_WEIGHT_RULES): SignatureWeightRule {
  const concept = describeSignatureConcept(signature);
  return getSignatureWeightRule(concept?.key ?? signature.key, rules);
}

export function getSignatureGroupWeight(
  signatureKey: string,
  group: "analysis" | "retrieval" | "workflow",
  rules?: SignatureWeightRule[],
): number {
  const rule = getSignatureWeightRule(signatureKey, rules);
  if (!rule.enabled) return 0;
  if (group === "analysis") return rule.analysisWeight;
  if (group === "retrieval") return rule.retrievalWeight;
  return rule.workflowWeight;
}

export function getSignatureTagGroupWeight(
  signature: SignatureTag,
  group: "analysis" | "retrieval" | "workflow",
  rules?: SignatureWeightRule[],
): number {
  const rule = getSignatureWeightRuleForTag(signature, rules);
  if (!rule.enabled) return 0;
  if (group === "analysis") return rule.analysisWeight;
  if (group === "retrieval") return rule.retrievalWeight;
  return rule.workflowWeight;
}

export function weightedSignatureContext(signatures: SignatureTag[], rules?: SignatureWeightRule[]) {
  return signatures
    .map(signature => {
      const concept = describeSignatureConcept(signature);
      const rule = getSignatureWeightRuleForTag(signature, rules);
      return {
        key: signature.key,
        value: signature.value,
        canonicalKey: concept?.key ?? normalizeSignatureKeyComparable(signature.key),
        canonicalValue: concept?.value ?? signature.value,
        conceptId: concept?.conceptId,
        valueId: "valueId" in (concept ?? {}) ? concept?.valueId : undefined,
        domain: concept?.domain,
        conceptPath: concept?.path,
        analysisWeight: rule.enabled ? rule.analysisWeight : 0,
        retrievalWeight: rule.enabled ? rule.retrievalWeight : 0,
        workflowWeight: rule.enabled ? rule.workflowWeight : 0,
        reason: rule.reason,
      };
    })
    .sort((a, b) =>
      (b.analysisWeight + b.retrievalWeight + b.workflowWeight) -
      (a.analysisWeight + a.retrievalWeight + a.workflowWeight)
    );
}
