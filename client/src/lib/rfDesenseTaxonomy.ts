import { SignatureTag } from "./mockData";
import { normalizeSignatureIdentityComparable, normalizeSignatureKeyComparable } from "./signatureAliasResolver";
import { classifyCoreRfTriage } from "@shared/rfFipRuleCatalog";

export interface SignatureTaxonomyGroup {
  category: string;
  keys: string[];
}

export interface DesenseCaseInsight {
  category: string;
  mechanism: string;
  symptomPattern: string;
  diagnosticTests: string[];
  suspectedStructures: string[];
  decisionRationale: string[];
  actionGuide: string;
  lessonsLearned: string;
}

export const RF_DESENSE_TAXONOMY: SignatureTaxonomyGroup[] = [
  {
    category: "원인 분류",
    keys: [
      "Desense Category",
      "Mechanism",
      "Diagnostic Gate",
      "Tx Dependency",
      "Conducted Result",
      "OTA Result",
      "Failure Mode",
    ],
  },
  {
    category: "RF 성능",
    keys: [
      "RAT",
      "Band",
      "Band DL",
      "Band UL",
      "CA Combo",
      "Channel",
      "Affected Channel",
      "RB/BW",
      "Degradation (dB)",
      "Noise Floor Rise (dB)",
    ],
  },
  {
    category: "Tx-induced / PIM",
    keys: [
      "Tx Correlated",
      "Tx Dependency",
      "Tx Threshold (dBm)",
      "Tx Power",
      "UL RB Dependency",
      "UL RB Position",
      "IM Product",
      "IM Order",
      "IM Freq Match",
      "PIM Risk",
      "1-tone vs 2-tone",
    ],
  },
  {
    category: "Internal Desense / Spur",
    keys: [
      "Trigger",
      "Noise Source",
      "Desense Type",
      "Spur Source",
      "Harmonic Source",
      "Display State",
      "Camera State",
      "Charging State",
      "Thermal Sensitive",
    ],
  },
  {
    category: "기구/접촉 구조",
    keys: [
      "Contact Structure",
      "Contact Type",
      "Contact Location",
      "Contact Material",
      "Antenna Path",
      "Mechanical Stress",
      "Pressure Sensitive",
      "Pressure Location",
      "Torque Sensitive",
      "Drop History",
      "Reassembly Effect",
    ],
  },
  {
    category: "발생 패턴/환경",
    keys: [
      "Temporal Pattern",
      "Onset Condition",
      "Recovery Condition",
      "Unit Scope",
      "Lot Number",
      "Reproducibility",
      "Temperature (degC)",
      "Humidity Dependent",
      "THB History",
      "Thermal Cycle",
    ],
  },
];

export function getSignatureValue(signatures: SignatureTag[], key: string): string | undefined {
  return signatures.find(sig => sig.key.toLowerCase() === key.toLowerCase())?.value;
}

function hasConceptKey(signatures: SignatureTag[], conceptKey: string): boolean {
  const normalizedKey = normalizeSignatureKeyComparable(conceptKey).toLowerCase();
  const normalizedConceptKey = normalizeSignatureIdentityComparable({ key: conceptKey, value: "True" }).key.toLowerCase();
  return signatures.some(sig =>
    normalizeSignatureKeyComparable(sig.key).toLowerCase() === normalizedKey ||
    normalizeSignatureIdentityComparable(sig).key.toLowerCase() === normalizedConceptKey
  );
}

function hasConceptValue(signatures: SignatureTag[], conceptKey: string, pattern: RegExp): boolean {
  const normalizedKey = normalizeSignatureKeyComparable(conceptKey).toLowerCase();
  const normalizedConceptKey = normalizeSignatureIdentityComparable({ key: conceptKey, value: "True" }).key.toLowerCase();
  return signatures.some(sig => {
    const identity = normalizeSignatureIdentityComparable(sig);
    const keyMatches =
      normalizeSignatureKeyComparable(sig.key).toLowerCase() === normalizedKey ||
      identity.key.toLowerCase() === normalizedConceptKey;
    return keyMatches && (pattern.test(sig.value) || pattern.test(identity.value));
  });
}

export function classifyDesenseCase(signatures: SignatureTag[], fallbackText = ""): DesenseCaseInsight {
  const joined = `${fallbackText} ${signatures.map(sig => `${sig.key} ${sig.value}`).join(" ")}`.normalize("NFKC").toLowerCase();
  const coreClassification = classifyCoreRfTriage(fallbackText, signatures);
  const explicitCategory = getSignatureValue(signatures, "Desense Category");
  const explicitMechanism = getSignatureValue(signatures, "Mechanism");
  const txCorrelated =
    hasConceptValue(signatures, "Tx Correlated", /true|high|correlated/i) ||
    hasConceptKey(signatures, "Tx Power") ||
    /tx|ul power|pa\b|송신|고출력/.test(joined);
  const caOrIm =
    hasConceptKey(signatures, "CA Combo") ||
    hasConceptKey(signatures, "IM Product") ||
    /ca combo|b\d+\+|im3|im5|harmonic|2-tone|2 tone|혼변조|고조파/.test(joined);
  const contact =
    hasConceptKey(signatures, "Contact Structure") ||
    hasConceptKey(signatures, "Pressure Sensitive") ||
    hasConceptKey(signatures, "Reassembly Effect") ||
    /pim|c-clip|clip|shield|screw|bracket|spring|contact|foam|strap|feed|back glass|접촉|가압|압력|쉴드|실드|낙하/.test(joined);
  const internal =
    hasConceptKey(signatures, "Noise Source") ||
    /display|mipi|pmic|dcdc|dc-dc|ddr|usb|camera|charging|clock|spur|디스플레이|카메라|충전|전원|클럭|스퍼|불요파/.test(joined);
  const conductedOtaSplit = hasConceptKey(signatures, "Conducted Result") && hasConceptKey(signatures, "OTA Result");
  const thermal = hasConceptKey(signatures, "Thermal Sensitive") || /thermal|temperature|heat|온도|고온|저온|발열/.test(joined);

  let category = explicitCategory ?? (coreClassification.category === "RF Desense Triage" ? "Antenna 성능 저하" : coreClassification.category);
  if (!explicitCategory) {
    if (txCorrelated && contact && caOrIm) category = "TX-induced PIM Desense";
    else if (txCorrelated && caOrIm) category = "TX-induced Desense";
    else if (contact) category = "PIM/접촉 비선형";
    else if (internal) category = "Internal Desense / Spurious";
    else if (conductedOtaSplit) category = "Antenna/기구 Coupling";
    else if (thermal) category = "환경/사용 조건";
  }

  const mechanism = explicitMechanism ??
    (category.includes("PIM")
      ? "고출력 Tx 성분이 비선형 접촉부에서 IM 성분을 만들고, 해당 성분이 Rx 대역 noise floor를 상승시킵니다."
      : category.includes("TX-induced")
      ? "PA noise/leakage 또는 Tx distortion이 filter, duplexer, antenna isolation margin을 넘어 Rx 대역으로 유입됩니다."
      : category.includes("Internal")
      ? "고속 인터페이스, 전원, clock noise가 antenna 또는 Rx path로 결합되어 특정 channel 감도를 저하시킵니다."
      : "Antenna 효율, RF path loss, 조립 조건, 환경 조건 중 하나가 Rx sensitivity margin을 악화시킵니다.");

  const diagnosticTests = Array.from(new Set([
    ...coreClassification.diagnosticTests,
    txCorrelated ? "Tx power sweep으로 감도 저하 slope 확인" : "Tx off baseline과 기능 ON/OFF baseline 분리",
    caOrIm ? "CA/2-tone 조건에서 IM3/IM5 주파수와 Rx fail channel 겹침 계산" : "Fail channel별 spectrum scan으로 spur/filter skirt 확인",
    conductedOtaSplit ? "Conducted RX와 OTA TIS/EIS를 분리 측정" : "Conducted RX 정상 여부를 먼저 확인",
    contact ? "C-clip, shield, screw, bracket 압력/torque/재조립 전후 비교" : "의심 noise source ON/OFF 및 shielding A/B test",
  ]));

  const suspectedStructures = [
    ...(contact ? ["C-clip", "shield can", "screw/bracket", "antenna feed/contact"] : []),
    ...(internal ? ["Display/MIPI", "PMIC/DCDC", "DDR/AP clock", "USB/charging route"] : []),
    ...(txCorrelated ? ["PA output", "duplexer/filter isolation", "FEM/antenna switch linearity"] : []),
    ...(conductedOtaSplit ? ["antenna route", "cover/metal coupling", "GND contact"] : []),
  ];

  const decisionRationale = [
    txCorrelated ? "Tx 조건과 감도 저하가 연결되어 TX-induced 계열을 우선 검토합니다." : "Tx 독립 조건 확인 전까지 내부 EMI/안테나 계열 가능성을 유지합니다.",
    caOrIm ? "CA/IM/Harmonic 단서가 있어 주파수 계산 기반 검증이 필요합니다." : "주파수 계산 단서가 부족하므로 channel sweep이 선행되어야 합니다.",
    contact ? "압력, 재조립, 낙하, 접촉 단서가 있어 PIM 또는 접촉 비선형 가능성이 상승합니다." : "접촉 민감도 단서가 부족해 구조물 가압 test가 필요합니다.",
  ];

  return {
    category,
    mechanism,
    symptomPattern: getSignatureValue(signatures, "Diagnostic Gate") ?? "조건부 감도 저하 여부를 Tx, 기능 ON/OFF, conducted/OTA, channel sweep으로 분리합니다.",
    diagnosticTests,
    suspectedStructures: suspectedStructures.length > 0 ? suspectedStructures : ["antenna matching", "RF conducted path", "LNA/FEM/filter"],
    decisionRationale,
    actionGuide: category.includes("PIM")
      ? "IM 주파수 계산과 접촉부 압력/재조립 A/B test를 먼저 수행하고, 개선되면 접촉 margin 또는 RF current path 안정화로 검증합니다."
      : category.includes("Internal")
      ? "기능별 ON/OFF, near-field scan, 임시 shielding, clock/PMIC 설정 변경으로 noise source를 좁힙니다."
      : "Conducted/OTA 분리 후 path loss, antenna detuning, filter/LNA/FEM 조건을 단계적으로 배제합니다.",
    lessonsLearned: "최종 결론보다 판별 시험 흐름과 배제 근거를 함께 남겨야 다음 이슈에서 유사도와 시험 추천 품질이 올라갑니다.",
  };
}
