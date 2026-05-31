import type { SignatureTag } from "./mockData";

export type SignatureConceptDomain = "rf" | "mechanical" | "test" | "source" | "workflow";
export type SignatureValueType = "enum" | "boolean" | "number" | "text";
export type SignatureRelationType = "requires" | "boosts" | "conflicts" | "coOccurs" | "blocksConclusion";

export interface SignatureConceptValue {
  id: string;
  displayValue: string;
  aliases?: string[];
}

export interface SignatureConceptRelation {
  type: SignatureRelationType;
  targetConceptId?: string;
  targetKey?: string;
  targetValue?: string;
  reason: string;
  missingInfo?: string;
}

export interface SignatureConcept {
  id: string;
  parentId?: string;
  domain: SignatureConceptDomain;
  displayKey: string;
  keyAliases?: string[];
  valueType: SignatureValueType;
  values: SignatureConceptValue[];
  relations?: SignatureConceptRelation[];
}

export interface SignatureConceptMatch {
  conceptId: string;
  valueId: string;
  domain: SignatureConceptDomain;
  path: string;
  key: string;
  value: string;
  relations: SignatureConceptRelation[];
}

export interface SignatureConceptKeyMatch {
  conceptId: string;
  domain: SignatureConceptDomain;
  path: string;
  key: string;
  valueType: SignatureValueType;
}

export interface SignatureRelationHint extends SignatureConceptRelation {
  sourceKey: string;
  sourceValue: string;
  sourceConceptId: string;
}

export interface SignatureTermAliasEntry {
  id: string;
  canonicalKey: string;
  canonicalValue: string;
  aliases: string[];
  domain: SignatureConceptDomain;
  conceptId: string;
  valueId: string;
  status: "approved" | "pending";
  confidence: number;
  source: "builtin" | "user-approved" | "imported";
}

export function normalizeConceptToken(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_./()[\]{}]+/g, "")
    .trim();
}

export function normalizeConceptKey(key: string): string {
  const normalized = normalizeConceptToken(key);
  if (["structure", "contactstructure", "contacttype", "suspectedstructure", "mechanicalstructure"].includes(normalized)) {
    return "Contact Structure";
  }
  if (["conducted", "conductedrx", "cabledrx", "rfcable"].includes(normalized)) return "Conducted Result";
  if (["ota", "radiated", "chamber", "tis", "eis"].includes(normalized)) return "OTA Result";
  return key.trim();
}

export const SIGNATURE_CONCEPT_REGISTRY: SignatureConcept[] = [
  {
    id: "rf.tx_correlation",
    parentId: "rf",
    domain: "rf",
    displayKey: "Tx Correlated",
    keyAliases: ["Tx Dependency", "UL Dependency"],
    valueType: "boolean",
    values: [
      { id: "true", displayValue: "True", aliases: ["tx on", "ul power", "tx high", "high power", "high power only", "ca high power", "송신", "송신on", "송신 on", "고출력", "tx correlated"] },
      { id: "false", displayValue: "False", aliases: ["tx off", "ul off", "송신 off", "송신off", "tx independent", "tx 무관"] },
    ],
    relations: [
      {
        type: "requires",
        targetConceptId: "rf.tx_power",
        targetKey: "Tx Power",
        reason: "Tx 연동 단서가 있으면 power sweep 없이는 원인 강도를 확정하기 어렵습니다.",
        missingInfo: "Tx power sweep result",
      },
      {
        type: "requires",
        targetConceptId: "test.conducted_result",
        targetKey: "Conducted Result",
        reason: "Tx 연동 desense는 conducted baseline으로 RF path와 OTA path를 먼저 분리해야 합니다.",
        missingInfo: "Conducted RX baseline",
      },
    ],
  },
  {
    id: "rf.tx_power",
    parentId: "rf",
    domain: "rf",
    displayKey: "Tx Power",
    valueType: "number",
    values: [{ id: "numeric", displayValue: "Measured dBm", aliases: ["tx power", "ul power", "power sweep", "pout", "dBm", "dbm", "송신 출력", "출력 sweep"] }],
  },
  {
    id: "rf.ca_combo",
    parentId: "rf",
    domain: "rf",
    displayKey: "CA Combo",
    valueType: "text",
    values: [{ id: "combo", displayValue: "CA Combo", aliases: ["ca", "carrier aggregation", "endc", "en-dc", "combo", "조합", "캐리어 aggregation"] }],
    relations: [
      {
        type: "requires",
        targetConceptId: "rf.im_product",
        targetKey: "IM Product",
        reason: "CA 조합 단서는 IM/harmonic 계산과 channel sweep이 있어야 판별력이 생깁니다.",
        missingInfo: "IM3/IM5 frequency calculation",
      },
    ],
  },
  {
    id: "rf.im_product",
    parentId: "rf",
    domain: "rf",
    displayKey: "IM Product",
    keyAliases: ["IM Order"],
    valueType: "enum",
    values: [
      { id: "im3", displayValue: "IM3 mentioned", aliases: ["im3", "im order", "im3 overlaps b3 dl", "contact nonlinearity im3", "3rd order", "third order", "3차", "3차 혼변조", "혼변조3"] },
      { id: "im5", displayValue: "IM5 mentioned", aliases: ["im5", "5th order", "fifth order", "5차", "5차 혼변조", "혼변조5"] },
      { id: "harmonic", displayValue: "Harmonic mentioned", aliases: ["harmonic", "harmonics", "harmonic overlaps b7 dl", "pa harmonic overlap", "2nd harmonic", "3rd harmonic", "고조파", "하모닉"] },
    ],
    relations: [
      {
        type: "boosts",
        targetConceptId: "rf.desense_category",
        targetKey: "Desense Category",
        targetValue: "TX-induced PIM Desense",
        reason: "IM product 단서는 Tx-induced/PIM 계열 가설의 우선순위를 올립니다.",
      },
    ],
  },
  {
    id: "rf.desense_type",
    parentId: "rf",
    domain: "rf",
    displayKey: "Desense Type",
    valueType: "enum",
    values: [
      {
        id: "sensitivity_drop",
        displayValue: "Sensitivity Drop",
        aliases: ["desense", "de-sense", "sensitivity drop", "sensitivity loss", "rx sensitivity drop", "rx loss", "tis drop", "eis drop", "감도저하", "감도 저하", "수신감도", "수신 감도", "수신 감도 저하"],
      },
      {
        id: "noise_floor_rise",
        displayValue: "Noise Floor Rise",
        aliases: ["noise floor", "noise floor rise", "nf rise", "floor rise", "노이즈 플로어", "노이즈 floor", "노이즈 상승", "바닥잡음 상승"],
      },
      {
        id: "spur",
        displayValue: "Spur",
        aliases: ["spur", "spurious", "narrow spur", "clock spur", "mipi harmonic coupling", "스퍼", "스퓨리어스", "불요파"],
      },
      {
        id: "broadband_noise",
        displayValue: "Broadband Noise",
        aliases: ["broadband noise", "wideband noise", "bb noise", "광대역 noise", "광대역 잡음", "wide noise"],
      },
      {
        id: "channel_specific_fail",
        displayValue: "Channel-specific Fail",
        aliases: ["channel specific", "specific channel", "fail channel", "channel fail", "특정 channel", "특정 채널", "채널별 불량"],
      },
    ],
  },
  {
    id: "test.conducted_result",
    parentId: "test",
    domain: "test",
    displayKey: "Conducted Result",
    keyAliases: ["Conducted", "Conducted RX"],
    valueType: "enum",
    values: [
      { id: "check_required", displayValue: "Check required", aliases: ["conducted", "conducted rx", "conducted test", "rf cable", "cable rx", "cabled rx", "cable measurement", "전도", "전도시험", "전도 테스트", "케이블", "케이블 측정"] },
      { id: "normal", displayValue: "Normal", aliases: ["conducted normal", "conducted pass", "cable pass", "cable normal", "tx off normal", "전도 정상", "케이블 정상", "전도 pass"] },
      { id: "tx_off_baseline", displayValue: "Tx OFF baseline mentioned", aliases: ["tx off baseline", "tx-off baseline", "tx off base", "송신 off baseline", "송신 off 기준"] },
    ],
  },
  {
    id: "test.ota_result",
    parentId: "test",
    domain: "test",
    displayKey: "OTA Result",
    keyAliases: ["OTA", "Radiated"],
    valueType: "enum",
    values: [
      { id: "check_required", displayValue: "Check required", aliases: ["ota", "tis", "eis", "chamber", "radiated", "radiated test", "anechoic", "방사", "챔버", "무반사실", "방사 시험"] },
      { id: "fail", displayValue: "Fail", aliases: ["ota fail", "tis fail", "eis fail", "chamber fail", "radiated fail", "display on + tx high fail", "fail after drop", "방사 불량", "챔버 불량", "tis 불량", "eis 불량"] },
    ],
  },
  {
    id: "mechanical.contact_structure",
    parentId: "mechanical",
    domain: "mechanical",
    displayKey: "Contact Structure",
    keyAliases: ["Structure", "Contact Type", "Suspected Structure", "Mechanical Structure", "Antenna Path"],
    valueType: "enum",
    values: [
      { id: "back_glass", displayValue: "Back Glass", aliases: ["backglass", "back glass", "back-glass", "rear glass", "rear cover glass", "back cover glass", "백글라스", "백글", "후면 글라스", "후면유리"] },
      { id: "shield_can", displayValue: "Shield Can", aliases: ["shield can", "shield-can", "shieldcan", "shield clip", "shield contact", "쉴드캔", "쉴드 캔", "쉴드클립", "차폐캔", "차폐 캔", "차폐 클립"] },
      { id: "spring_contact", displayValue: "Spring Contact", aliases: ["spring contact", "spring pin", "pogo", "pogo pin", "스프링", "스프링 접점", "포고핀"] },
      { id: "fpc", displayValue: "FPC/FPCB", aliases: ["fpc", "fpcb", "flex", "flex cable", "flexible pcb", "연성기판", "에프피씨"] },
      { id: "antenna_feed", displayValue: "Antenna Feed", aliases: ["antenna feed", "ant feed", "feed point", "feed", "안테나 피드", "급전부", "급전점"] },
      { id: "ground_strap", displayValue: "Ground Strap", aliases: ["ground strap", "gnd strap", "grounding strap", "gnd contact", "back cover gnd contact", "corroded gnd contact nonlinearity", "접지 스트랩", "그라운드 스트랩", "gnd 접점"] },
      { id: "mechanical_contact", displayValue: "Mechanical Contact", aliases: ["mechanical contact", "contact issue", "contact point", "접촉", "기구 접촉", "접점"] },
      { id: "fabric_foam", displayValue: "Fabric-over-Foam", aliases: ["fabric foam", "fabric-over-foam", "foam contact", "fof", "fabric over foam", "도전성 폼", "폼 접점"] },
    ],
    relations: [
      {
        type: "requires",
        targetConceptId: "mechanical.pressure_sensitive",
        targetKey: "Pressure Sensitive",
        reason: "구조물 접촉 의심은 가압 A/B 없이는 재현성과 방향성을 확인하기 어렵습니다.",
        missingInfo: "Pressure A/B test result",
      },
      {
        type: "coOccurs",
        targetConceptId: "mechanical.reassembly_effect",
        targetKey: "Reassembly Effect",
        reason: "접촉 구조물 이슈는 분해/재조립 효과와 함께 나타나는 경우가 많습니다.",
      },
    ],
  },
  {
    id: "mechanical.pressure_sensitive",
    parentId: "mechanical",
    domain: "test",
    displayKey: "Pressure Sensitive",
    valueType: "boolean",
    values: [{ id: "true", displayValue: "True", aliases: ["contact force", "press", "pressure", "pressure sensitive", "push test", "press test", "가압", "압력", "접촉압", "누름", "눌렀을때", "가압 민감"] }],
    relations: [
      {
        type: "boosts",
        targetConceptId: "mechanical.contact_structure",
        targetKey: "Contact Structure",
        reason: "압력 민감도는 접촉/PIM 계열 가설을 강화합니다.",
      },
    ],
  },
  {
    id: "mechanical.reassembly_effect",
    parentId: "mechanical",
    domain: "test",
    displayKey: "Reassembly Effect",
    keyAliases: ["Reassembly"],
    valueType: "enum",
    values: [{ id: "disappears", displayValue: "Disappears", aliases: ["reassembly", "re-assembly", "re assemble", "disassemble assemble", "tear down", "재조립", "재 조립", "분해조립", "분해 후 정상"] }],
    relations: [
      {
        type: "boosts",
        targetConceptId: "mechanical.contact_structure",
        targetKey: "Contact Structure",
        reason: "재조립 후 사라지는 현상은 접촉/조립 원인 가능성을 올립니다.",
      },
    ],
  },
  {
    id: "source.noise_source",
    parentId: "source",
    domain: "source",
    displayKey: "Noise Source",
    keyAliases: ["Spur Source", "Harmonic Source"],
    valueType: "enum",
    values: [
      { id: "pmic_dcdc", displayValue: "PMIC/DCDC", aliases: ["pmic", "dcdc", "dc-dc", "pmic/dcdc", "ap high load", "pmic setting", "buck", "smps", "inductor", "전원", "전원부", "인덕터"] },
      { id: "high_speed_interface", displayValue: "High-speed interface", aliases: ["mipi", "display", "display mipi", "mipi clock", "camera", "usb", "ddr", "pcie", "hsio", "디스플레이", "카메라", "고속 인터페이스"] },
    ],
    relations: [
      {
        type: "requires",
        targetConceptId: "workflow.diagnostic_gate",
        targetKey: "Diagnostic Gate",
        targetValue: "Function ON/OFF A/B",
        reason: "Noise source 단서는 기능 ON/OFF와 shielding A/B가 있어야 원인 후보를 줄일 수 있습니다.",
        missingInfo: "Function ON/OFF and shielding A/B result",
      },
    ],
  },
  {
    id: "workflow.diagnostic_gate",
    parentId: "workflow",
    domain: "workflow",
    displayKey: "Diagnostic Gate",
    keyAliases: ["Trigger"],
    valueType: "enum",
    values: [
      { id: "pressure_ab", displayValue: "Pressure A/B test", aliases: ["pressure ab", "pressure a/b", "tx power sweep + pressure a/b", "press ab", "push ab", "가압 ab", "압력 ab", "누름 ab"] },
      { id: "function_on_off", displayValue: "Function ON/OFF A/B", aliases: ["function on off", "function on/off", "display on", "display on/off + harmonic scan", "ap load + pmic setting a/b", "on off test", "shielding ab", "shielding a/b", "기능 on off", "기능 ab", "쉴딩 ab"] },
      { id: "ca_channel_sweep", displayValue: "CA channel sweep + IM calculation", aliases: ["channel sweep", "ca channel sweep + spectrum scan", "im calculation", "frequency calculation", "freq calc", "채널 sweep", "채널 스윕", "주파수 계산"] },
      { id: "two_tone_pim", displayValue: "2-tone PIM test", aliases: ["2-tone", "two tone", "2tone", "pim test", "2-tone pim", "2-tone pim + compression sweep", "thb a/b + cleaning test", "drop a/b + conducted/ota split", "aging/thb a/b + replacement test", "투톤", "2톤", "pim 시험"] },
    ],
  },
];

function conceptKeyTokens(concept: SignatureConcept): string[] {
  return [concept.displayKey, ...(concept.keyAliases ?? [])].map(normalizeConceptToken).filter(Boolean);
}

function conceptValueTokens(value: SignatureConceptValue): string[] {
  return [value.displayValue, ...(value.aliases ?? [])].map(normalizeConceptToken).filter(Boolean);
}

function valueOnlyCanonicalizationAllowed(concept: SignatureConcept, value: SignatureConceptValue): boolean {
  if (concept.valueType === "boolean" || concept.valueType === "number") return false;
  const genericTokens = new Set(["true", "false", "normal", "fail", "checkrequired", "measuredvdbm", "cacombo"]);
  return !genericTokens.has(normalizeConceptToken(value.displayValue));
}

function conceptPath(concept: SignatureConcept): string {
  return `${concept.domain}.${concept.id.split(".").slice(1).join(".") || concept.id}`;
}

export function resolveSignatureConceptKey(key: string): SignatureConceptKeyMatch | undefined {
  const normalizedKey = normalizeConceptToken(normalizeConceptKey(key));
  for (const concept of SIGNATURE_CONCEPT_REGISTRY) {
    if (!conceptKeyTokens(concept).includes(normalizedKey)) continue;
    return {
      conceptId: concept.id,
      domain: concept.domain,
      path: conceptPath(concept),
      key: concept.displayKey,
      valueType: concept.valueType,
    };
  }
  return undefined;
}

export function conceptAliasEntries(): SignatureTermAliasEntry[] {
  return SIGNATURE_CONCEPT_REGISTRY.flatMap(concept =>
    concept.values.map(value => ({
      id: `${concept.id}.${value.id}`,
      canonicalKey: concept.displayKey,
      canonicalValue: value.displayValue,
      aliases: value.aliases ?? [],
      domain: concept.domain,
      conceptId: concept.id,
      valueId: value.id,
      status: "approved" as const,
      confidence: 1,
      source: "builtin" as const,
    }))
  );
}

export function resolveSignatureConcept(tag: SignatureTag): SignatureConceptMatch | undefined {
  const normalizedKey = normalizeConceptToken(normalizeConceptKey(tag.key));
  const normalizedValue = normalizeConceptToken(tag.value);

  for (const concept of SIGNATURE_CONCEPT_REGISTRY) {
    const keyMatches = conceptKeyTokens(concept).includes(normalizedKey);
    for (const value of concept.values) {
      const valueMatches = conceptValueTokens(value).includes(normalizedValue);
      if (keyMatches && valueMatches) {
        return {
          conceptId: concept.id,
          valueId: value.id,
          domain: concept.domain,
          path: conceptPath(concept),
          key: concept.displayKey,
          value: value.displayValue,
          relations: concept.relations ?? [],
        };
      }
    }
  }

  for (const concept of SIGNATURE_CONCEPT_REGISTRY) {
    for (const value of concept.values) {
      if (!valueOnlyCanonicalizationAllowed(concept, value)) continue;
      if (conceptValueTokens(value).includes(normalizedValue)) {
        return {
          conceptId: concept.id,
          valueId: value.id,
          domain: concept.domain,
          path: conceptPath(concept),
          key: concept.displayKey,
          value: value.displayValue,
          relations: concept.relations ?? [],
        };
      }
    }
  }

  return undefined;
}

export function canonicalizeSignatureByConcept(tag: SignatureTag): SignatureTag {
  const match = resolveSignatureConcept(tag);
  return match ? { ...tag, key: match.key, value: match.value } : tag;
}

export function signatureConceptComparable(tag: SignatureTag): { key: string; value: string } {
  const match = resolveSignatureConcept(tag);
  if (match) return { key: match.conceptId, value: match.valueId };
  return {
    key: normalizeConceptToken(normalizeConceptKey(tag.key)),
    value: normalizeConceptToken(tag.value),
  };
}

export function signatureConceptKeyComparable(key: string): string {
  return resolveSignatureConceptKey(key)?.conceptId ?? normalizeConceptToken(normalizeConceptKey(key));
}

export function describeSignatureConcept(tag: SignatureTag) {
  const match = resolveSignatureConcept(tag);
  if (!match) {
    const keyMatch = resolveSignatureConceptKey(tag.key);
    return keyMatch
      ? {
          conceptId: keyMatch.conceptId,
          domain: keyMatch.domain,
          path: keyMatch.path,
          key: keyMatch.key,
          valueType: keyMatch.valueType,
        }
      : undefined;
  }
  return {
    conceptId: match.conceptId,
    valueId: match.valueId,
    domain: match.domain,
    path: match.path,
    key: match.key,
    value: match.value,
  };
}

export function buildSignatureRelationHints(signatures: SignatureTag[]): SignatureRelationHint[] {
  const hints: SignatureRelationHint[] = [];
  for (const tag of signatures) {
    const match = resolveSignatureConcept(tag);
    if (!match) continue;
    for (const relation of match.relations) {
      hints.push({
        ...relation,
        sourceKey: match.key,
        sourceValue: match.value,
        sourceConceptId: match.conceptId,
      });
    }
  }
  return hints;
}

export function requiredMissingInfoFromRelations(signatures: SignatureTag[]): Array<{ text: string; key: string }> {
  const comparable = new Set(signatures.map(tag => signatureConceptComparable(tag).key));
  const hints = buildSignatureRelationHints(signatures);
  const missing: Array<{ text: string; key: string }> = [];

  for (const hint of hints) {
    if (hint.type !== "requires" || !hint.missingInfo) continue;
    const targetKey = hint.targetConceptId ?? normalizeConceptToken(normalizeConceptKey(hint.targetKey ?? ""));
    if (!targetKey || comparable.has(targetKey)) continue;
    if (!missing.some(item => item.text === hint.missingInfo)) {
      missing.push({ text: hint.missingInfo, key: hint.targetKey ?? hint.sourceKey });
    }
  }

  return missing;
}
