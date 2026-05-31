export interface CoreSignature {
  key: string;
  value: string;
  isNew?: boolean;
}

export interface CoreClassification {
  category: string;
  mechanism: string;
  diagnosticTests: string[];
}

export const RF_INTENT_TERMS = [
  "rf",
  "rx",
  "tx",
  "ul",
  "dl",
  "ota",
  "tis",
  "eis",
  "desense",
  "sensitivity",
  "antenna",
  "band",
  "pim",
  "im3",
  "im5",
  "spur",
  "spurious",
  "harmonic",
  "conducted",
  "chamber",
  "shield",
  "clip",
  "noise",
  "dbm",
  "감도",
  "감도저하",
  "수신감도",
  "송신",
  "출력",
  "전도",
  "방사",
  "챔버",
  "안테나",
  "쉴드",
  "실드",
  "접촉",
  "가압",
  "노이즈",
  "스퍼",
  "혼변조",
  "고조파",
  "주파수",
  "측정",
  "시험",
];

function addSignature(signatures: CoreSignature[], key: string, value?: string) {
  if (!value?.trim()) return;
  const exists = signatures.some(item =>
    item.key.toLowerCase() === key.toLowerCase() &&
    item.value.toLowerCase() === value.toLowerCase()
  );
  if (!exists) signatures.push({ key, value, isNew: true });
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

function txPowerValue(text: string): string | undefined {
  const match = /(?:tx|ul|transmit|power|송신|출력|고출력)[^\d]{0,16}(\d+(?:\.\d+)?)\s*dBm/i.exec(text);
  return match ? `${match[1]}dBm` : undefined;
}

export function hasRfAnalysisIntent(text: string, attachmentCount = 0): boolean {
  if (attachmentCount > 0) return true;
  const normalized = text.normalize("NFKC").toLowerCase();
  if (/\b(?:b|n)\d{1,3}\b/i.test(text)) return true;
  if (/\d+(?:\.\d+)?\s*dB(?:m)?/i.test(text)) return true;
  return RF_INTENT_TERMS.some(term => normalized.includes(term.toLowerCase()));
}

export function extractCoreRfSignatures(text: string): CoreSignature[] {
  const signatures: CoreSignature[] = [];
  const normalized = text.normalize("NFKC").toLowerCase();

  const band = /\b((?:B|n)\d{1,3})\b/i.exec(text)?.[1];
  addSignature(signatures, "Band", band?.toUpperCase());

  const caCombo = /\b((?:B|n)\d{1,3}\s*\+\s*(?:B|n)\d{1,3}(?:\s*\+\s*(?:B|n)\d{1,3})*)\b/i.exec(text)?.[1];
  addSignature(signatures, "CA Combo", caCombo?.replace(/\s+/g, "").toUpperCase());

  const degradation = /(\d+(?:\.\d+)?)\s*dB(?!m)/i.exec(text)?.[1];
  addSignature(signatures, "Degradation (dB)", degradation ? `${degradation}dB` : undefined);

  const power = txPowerValue(text);
  addSignature(signatures, "Tx Power", power);

  if (hasAny(normalized, [/desense/i, /sensitivity\s*(drop|degrad|loss)/i, /감도\s*(저하|열화|하락|drop)/i, /수신\s*감도/i])) {
    addSignature(signatures, "Desense Type", "Sensitivity Drop");
  }

  if (hasAny(normalized, [/tx\s*on/i, /ul power/i, /pa\b/i, /pim/i, /im3/i, /im5/i, /송신/i, /고출력/i]) || Boolean(power)) {
    addSignature(signatures, "Tx Dependency", power ? "High power only" : "Check required");
    addSignature(signatures, "Tx Correlated", "True");
  }

  if (hasAny(normalized, [/tx\s*off/i, /송신\s*off/i, /송신\s*꺼/i])) {
    addSignature(signatures, "Conducted Result", "Tx OFF baseline mentioned");
  }

  if (hasAny(normalized, [/conducted/i, /rf cable/i, /\bcable\b/i, /전도/i, /케이블/i])) {
    addSignature(signatures, "Conducted Result", hasAny(normalized, [/normal/i, /pass/i, /정상/i]) ? "Normal" : "Check required");
  }

  if (hasAny(normalized, [/ota/i, /tis/i, /eis/i, /chamber/i, /radiated/i, /방사/i, /챔버/i, /안테나/i])) {
    addSignature(signatures, "OTA Result", hasAny(normalized, [/fail/i, /ng/i, /degrad/i, /drop/i, /불량/i, /저하/i, /하락/i]) ? "Fail" : "Check required");
  }

  if (hasAny(normalized, [/contact\s*force/i, /pressure/i, /press/i, /push/i, /접촉압/i, /가압/i, /압력/i, /누름/i])) {
    addSignature(signatures, "Pressure Sensitive", "True");
    addSignature(signatures, "Diagnostic Gate", "Pressure A/B test");
  }

  if (hasAny(normalized, [/drop/i, /낙하/i, /충격/i])) {
    addSignature(signatures, "Drop History", "True");
    addSignature(signatures, "Mechanical Stress", "Drop");
  }

  if (hasAny(normalized, [/back\s*glass/i, /backglass/i, /rear\s*glass/i, /rear\s*cover/i, /백글라스/i, /백글/i, /후면\s*유리/i])) {
    addSignature(signatures, "Contact Structure", "Back Glass");
  }

  if (hasAny(normalized, [/shield\s*can/i, /shield-can/i, /쉴드\s*캔/i, /실드\s*캔/i, /차폐\s*캔/i])) {
    addSignature(signatures, "Contact Structure", "Shield Can");
    addSignature(signatures, "Contact Type", "Shield Can");
  }

  if (hasAny(normalized, [/c-?clip/i, /shield/i, /screw/i, /bracket/i, /spring/i, /pogo/i, /foam/i, /strap/i, /feed/i, /contact/i, /접촉/i, /쉴드/i, /실드/i, /스크류/i, /브라켓/i, /스프링/i, /포고/i, /폼/i, /스트랩/i, /급전/i])) {
    addSignature(signatures, "PIM Risk", "High");
    if (!signatures.some(tag => tag.key === "Contact Structure")) {
      addSignature(signatures, "Contact Structure", "Mechanical Contact");
    }
  }

  if (hasAny(normalized, [/im3/i, /im5/i, /2f/i, /3f/i, /pim/i, /intermod/i, /혼변조/i, /고조파/i])) {
    addSignature(signatures, "Desense Category", "TX-induced PIM Desense");
    addSignature(signatures, "Mechanism", "Contact nonlinearity / IM product");
    addSignature(signatures, "IM Product", /im5/i.test(normalized) ? "IM5 mentioned" : "IM3 mentioned");
  }

  if (hasAny(normalized, [/display/i, /mipi/i, /camera/i, /usb/i, /ddr/i, /pmic/i, /dcdc/i, /dc-dc/i, /charging/i, /clock/i, /spur/i, /디스플레이/i, /카메라/i, /충전/i, /전원/i, /클럭/i, /스퍼/i, /불요파/i])) {
    addSignature(signatures, "Desense Category", "Internal Desense / Spurious");
    addSignature(signatures, "Noise Source", hasAny(normalized, [/pmic/i, /dcdc/i, /dc-dc/i, /전원/i]) ? "PMIC/DCDC" : "High-speed interface");
    addSignature(signatures, "Diagnostic Gate", "Function ON/OFF A/B");
  }

  if (hasAny(normalized, [/thermal/i, /temperature/i, /heat/i, /온도/i, /고온/i, /저온/i, /발열/i])) {
    addSignature(signatures, "Thermal Sensitive", "True");
  }

  if (hasAny(normalized, [/reassembly/i, /re-assembly/i, /re\s*assemble/i, /재조립/i, /분해\s*조립/i])) {
    addSignature(signatures, "Reassembly Effect", "Disappears");
  }

  if (signatures.some(tag => tag.key === "CA Combo") && signatures.some(tag => tag.key === "Tx Correlated")) {
    addSignature(signatures, "Diagnostic Gate", "CA channel sweep + IM calculation");
    if (!signatures.some(tag => tag.key === "Desense Category")) {
      addSignature(signatures, "Desense Category", signatures.some(tag => tag.key === "PIM Risk") ? "TX-induced PIM Desense" : "TX-induced Desense");
    }
  }

  return signatures;
}

export function classifyCoreRfTriage(text: string, signatures: Array<{ key: string; value: string }>): CoreClassification {
  const haystack = `${text} ${signatures.map(item => `${item.key} ${item.value}`).join(" ")}`.normalize("NFKC").toLowerCase();
  const hasPim = /pim|im3|im5|intermod|혼변조|고조파/.test(haystack);
  const hasContact = /contact|shield|clip|spring|pogo|foam|strap|feed|back glass|백글|접촉|쉴드|실드|스프링|포고|급전/.test(haystack);
  const hasInternal = /display|mipi|pmic|dcdc|dc-dc|spur|harmonic|camera|usb|ddr|charging|clock|전원|디스플레이|카메라|충전|클럭|스퍼|불요파/.test(haystack);

  if (hasInternal && !hasPim) {
    return {
      category: "Internal Desense / Spurious",
      mechanism: "Internal high-speed, clock, or power noise coupling into the Rx path",
      diagnosticTests: ["Function ON/OFF A/B", "Near-field scan", "Harmonic/spur frequency map"],
    };
  }

  if (hasPim || hasContact) {
    return {
      category: "TX-induced PIM Desense",
      mechanism: "Contact nonlinearity or intermodulation product",
      diagnosticTests: ["Tx power sweep", "IM3/IM5 frequency check", "Pressure/contact A/B test"],
    };
  }

  return {
    category: "RF Desense Triage",
    mechanism: "Insufficient evidence for a narrower local classification",
    diagnosticTests: ["Conducted baseline", "OTA reproduction", "Band/channel sweep"],
  };
}
