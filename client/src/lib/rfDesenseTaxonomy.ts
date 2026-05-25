import { SignatureTag } from "./mockData";

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
      "Temperature (°C)",
      "Humidity Dependent",
      "THB History",
      "Thermal Cycle",
    ],
  },
];

export const RF_DESENSE_KEY_WEIGHTS: Record<string, number> = {
  "Desense Category": 8,
  Mechanism: 7,
  "Diagnostic Gate": 6,
  "Tx Dependency": 7,
  "Conducted Result": 6,
  "OTA Result": 6,
  "PIM Risk": 7,
  "Contact Structure": 7,
  "IM Product": 6,
  "CA Combo": 6,
  "Antenna Path": 5,
  "Mechanical Stress": 5,
  "Thermal Sensitive": 4,
  "Tx Correlated": 5,
  "Contact Type": 5,
  "Pressure Sensitive": 5,
  "IM Order": 4,
  "Desense Type": 4,
  Band: 4,
  "Band DL": 4,
  "Band UL": 3,
  RAT: 3,
  Trigger: 3,
  "Drop History": 3,
  "Reassembly Effect": 3,
  "Surface Condition": 3,
  "THB History": 2,
  "Thermal Dependent": 2,
};

export function getSignatureValue(signatures: SignatureTag[], key: string): string | undefined {
  return signatures.find(sig => sig.key.toLowerCase() === key.toLowerCase())?.value;
}

export function hasSignatureValue(signatures: SignatureTag[], key: string, pattern: RegExp): boolean {
  const value = getSignatureValue(signatures, key);
  return value ? pattern.test(value) : false;
}

export function classifyDesenseCase(signatures: SignatureTag[], fallbackText = ""): DesenseCaseInsight {
  const joined = `${fallbackText} ${signatures.map(sig => `${sig.key} ${sig.value}`).join(" ")}`.toLowerCase();
  const explicitCategory = getSignatureValue(signatures, "Desense Category");
  const explicitMechanism = getSignatureValue(signatures, "Mechanism");
  const txCorrelated = hasSignatureValue(signatures, "Tx Correlated", /true|yes|high|correlated/i) || /tx|ul power|pa|송신|고출력/.test(joined);
  const caOrIm = /ca combo|b\d+\+|im3|im5|harmonic|혼변조|고조파|2-tone|2 tone/.test(joined);
  const contact = /pim|c-clip|clip|shield|screw|bracket|spring|contact|foam|strap|feed|접촉|압력|토크|drop|낙하/.test(joined);
  const internal = /display|mipi|pmic|dcdc|dc-dc|ddr|usb|camera|charging|충전|전원|스위칭|clock|spur/.test(joined);
  const conductedOtaSplit = /conducted.*normal|conducted 정상|ota.*fail|ota.*나쁨|ota fail/.test(joined);
  const thermal = /thermal|temperature|온도|고온|저온|heat/.test(joined);

  let category = explicitCategory ?? "Antenna 성능 저하";
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
      ? "고출력 Tx 성분이 비선형 접촉부에서 IM 성분을 만들고, 해당 성분이 Rx 대역 noise floor를 상승시킴"
      : category.includes("TX-induced")
      ? "PA noise/leakage 또는 Tx distortion이 필터·duplexer·antenna isolation margin을 넘어 Rx 대역으로 유입"
      : category.includes("Internal")
      ? "고속 인터페이스/전원/clock 노이즈가 안테나 또는 Rx path로 결합되어 특정 channel의 감도를 저하시킴"
      : "안테나 효율, RF path loss, 조립 조건, 환경 조건 중 하나가 Rx sensitivity margin을 악화시킴");

  const diagnosticTests = [
    txCorrelated ? "Tx power sweep으로 감도 저하 slope 확인" : "Tx off baseline과 기능 ON/OFF baseline 분리",
    caOrIm ? "CA/2-tone 조건에서 IM3/IM5 주파수와 Rx fail channel 겹침 계산" : "Fail channel별 spectrum scan으로 spur/filter skirt 확인",
    conductedOtaSplit ? "Conducted RX와 OTA TIS/EIS를 분리 측정" : "Conducted RX 정상 여부를 먼저 확인",
    contact ? "C-clip/shield/screw/bracket 압력·torque·재조립 전후 비교" : "의심 noise source ON/OFF 및 shielding A/B test",
  ];

  const suspectedStructures = [
    ...(contact ? ["C-clip", "shield can", "screw/bracket", "antenna feed/contact"] : []),
    ...(internal ? ["Display/MIPI", "PMIC/DCDC", "DDR/AP clock", "USB/charging route"] : []),
    ...(txCorrelated ? ["PA output", "duplexer/filter isolation", "FEM/antenna switch linearity"] : []),
    ...(conductedOtaSplit ? ["antenna route", "cover/metal coupling", "GND contact"] : []),
  ];

  const decisionRationale = [
    txCorrelated ? "Tx 조건과 감도 저하가 연결되어 TX-induced 계열 우선" : "Tx 독립 조건 확인 전까지 내부 EMI/안테나 계열 가능성 유지",
    caOrIm ? "CA/IM/Harmonic 단서가 있어 주파수 계산 기반 검증 필요" : "주파수 계산 단서가 부족하므로 channel sweep이 선행되어야 함",
    contact ? "압력/재조립/낙하/접촉 단서가 있어 PIM 또는 접촉 비선형 가능성 상승" : "접촉 민감도 단서가 부족해 구조물 가압 test 필요",
  ];

  return {
    category,
    mechanism,
    symptomPattern: getSignatureValue(signatures, "Diagnostic Gate") ?? "조건부 감도 저하 여부를 Tx, 기능 ON/OFF, conducted/OTA, channel sweep으로 분리",
    diagnosticTests,
    suspectedStructures: suspectedStructures.length > 0 ? suspectedStructures : ["antenna matching", "RF conducted path", "LNA/FEM/filter"],
    decisionRationale,
    actionGuide: category.includes("PIM")
      ? "IM 주파수 계산과 접촉부 압력/재조립 A/B test를 먼저 수행하고, 개선안은 접촉력 margin 또는 RF current path 안정화로 검증"
      : category.includes("Internal")
      ? "기능별 ON/OFF, near-field scan, 임시 shielding, clock/PMIC 설정 변경으로 noise source를 좁힘"
      : "Conducted/OTA 분리 후 path loss, antenna detuning, filter/LNA/FEM 조건을 단계적으로 배제",
    lessonsLearned: "사례는 결론보다 판별 흐름과 배제 근거를 함께 남겨야 다음 이슈에서 유사도와 시험 추천 품질이 올라감",
  };
}
