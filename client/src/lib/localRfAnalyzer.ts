import { findSimilarCases } from "./similarCasesDb";
import { classifyDesenseCase } from "./rfDesenseTaxonomy";
import { SignatureTag } from "./mockData";

function addTag(tags: SignatureTag[], key: string, value: string) {
  if (!value.trim()) return;
  const exists = tags.some(tag => tag.key.toLowerCase() === key.toLowerCase() && tag.value.toLowerCase() === value.toLowerCase());
  if (!exists) tags.push({ key, value, isNew: true });
}

function extractFirst(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1];
}

export function extractRfSignatures(text: string): SignatureTag[] {
  const tags: SignatureTag[] = [];
  const normalized = text.toLowerCase();

  const band = extractFirst(text, /\b((?:B|n)\d{1,3})\b/i);
  if (band) addTag(tags, "Band", band.toUpperCase());

  const caCombo = extractFirst(text, /\b((?:B|n)\d{1,3}\s*\+\s*(?:B|n)\d{1,3}(?:\s*\+\s*(?:B|n)\d{1,3})*)\b/i);
  if (caCombo) addTag(tags, "CA Combo", caCombo.replace(/\s+/g, "").toUpperCase());

  const degradation = extractFirst(text, /(\d+(?:\.\d+)?)\s*dB(?!m)/i);
  if (degradation) addTag(tags, "Degradation (dB)", `${degradation}dB`);

  const txPower = extractFirst(text, /(?:tx|ul|송신|출력)[^\d]{0,16}(\d+(?:\.\d+)?)\s*dBm/i);
  if (txPower) {
    addTag(tags, "Tx Power", `${txPower}dBm`);
    addTag(tags, "Tx Correlated", "True");
  }

  if (/tx\s*on|ul power|송신|고출력|pa\b|dBm/i.test(text)) {
    addTag(tags, "Tx Dependency", txPower ? "High power only" : "Check required");
    addTag(tags, "Tx Correlated", "True");
  }

  if (/tx\s*off|송신\s*off|송신\s*꺼|tx\s*꺼/i.test(text)) {
    addTag(tags, "Conducted Result", "Tx OFF baseline mentioned");
  }

  if (/conducted|전도|케이블|rf cable/i.test(text)) {
    addTag(tags, "Conducted Result", /정상|normal|pass/i.test(text) ? "Normal" : "Check required");
  }

  if (/ota|tis|eis|방사|안테나/i.test(text)) {
    addTag(tags, "OTA Result", /fail|불량|저하|나쁨/i.test(text) ? "Fail" : "Check required");
  }

  if (/압력|press|누르|pressure/i.test(text)) {
    addTag(tags, "Pressure Sensitive", "True");
    addTag(tags, "Diagnostic Gate", "Pressure A/B test");
  }

  if (/drop|낙하|충격/i.test(text)) {
    addTag(tags, "Drop History", "True");
    addTag(tags, "Mechanical Stress", "Drop");
  }

  if (/c-?clip|shield|screw|bracket|spring|foam|strap|feed|접촉|스크류|쉴드|브라켓|스프링/i.test(text)) {
    addTag(tags, "PIM Risk", "High");
    addTag(tags, "Contact Structure", /shield|쉴드/i.test(text) ? "Shield Contact" : "Mechanical Contact");
  }

  if (/im3|im5|2f|3f|pim|혼변조|intermod/i.test(text)) {
    addTag(tags, "Desense Category", "TX-induced PIM Desense");
    addTag(tags, "Mechanism", "Contact nonlinearity / IM product");
    addTag(tags, "IM Product", /im5/i.test(normalized) ? "IM5 mentioned" : "IM3 mentioned");
  }

  if (/display|mipi|camera|usb|ddr|pmic|dcdc|dc-dc|charging|충전|전원|카메라|디스플레이/i.test(text)) {
    addTag(tags, "Desense Category", "Internal Desense / Spurious");
    addTag(tags, "Noise Source", /pmic|dcdc|dc-dc|전원/i.test(text) ? "PMIC/DCDC" : "High-speed interface");
    addTag(tags, "Diagnostic Gate", "Function ON/OFF A/B");
  }

  if (/thermal|temperature|온도|고온|저온|발열/i.test(text)) {
    addTag(tags, "Thermal Sensitive", "True");
  }

  if (tags.some(tag => tag.key === "CA Combo") && tags.some(tag => tag.key === "Tx Correlated")) {
    addTag(tags, "Diagnostic Gate", "CA channel sweep + IM calculation");
    addTag(tags, "Desense Category", tags.some(tag => tag.key === "PIM Risk") ? "TX-induced PIM Desense" : "TX-induced Desense");
  }

  return tags;
}

export function mergeSignatures(base: SignatureTag[], additions: SignatureTag[]): SignatureTag[] {
  const merged = [...base];
  for (const tag of additions) {
    const sameKey = merged.findIndex(item => item.key.toLowerCase() === tag.key.toLowerCase());
    if (sameKey >= 0) {
      if (merged[sameKey].value.toLowerCase() !== tag.value.toLowerCase()) {
        merged[sameKey] = { ...merged[sameKey], value: tag.value, isNew: true };
      }
    } else {
      merged.push(tag);
    }
  }
  return merged;
}

export function generateLocalRfReply(input: {
  text: string;
  existingSignatures: SignatureTag[];
  quotedSource?: string;
}): { content: string; extractedTags: SignatureTag[] } {
  const extractedTags = extractRfSignatures(input.text);
  const merged = mergeSignatures(input.existingSignatures, extractedTags);
  const insight = classifyDesenseCase(merged, input.text);
  const similarCases = findSimilarCases(merged, 20, 2);
  const missing: string[] = [];

  if (!merged.some(tag => tag.key === "Tx Power")) missing.push("Tx power sweep 결과");
  if (!merged.some(tag => tag.key === "Conducted Result")) missing.push("Conducted RX baseline");
  if (!merged.some(tag => tag.key === "OTA Result")) missing.push("OTA TIS/EIS 또는 chamber 재현 결과");
  if (!merged.some(tag => tag.key === "IM Product") && /tx|ca|pim|송신|고출력/i.test(input.text)) missing.push("IM3/IM5 주파수 계산값");

  const contextLine = input.quotedSource
    ? `인용하신 "${input.quotedSource}" 내용을 이전 분석 맥락으로 반영했습니다.`
    : "현재 채팅 입력과 기존 Signature를 함께 보았습니다.";

  return {
    extractedTags,
    content: [
      `우선 분류: ${insight.category}`,
      "",
      `판단 근거: ${insight.decisionRationale.join(" / ")}`,
      "",
      `권장 판별 시험:\n${insight.diagnosticTests.map(test => `- ${test}`).join("\n")}`,
      "",
      `부족 정보:\n${missing.length ? missing.map(item => `- ${item}`).join("\n") : "- 현재 입력 기준으로 핵심 분기 정보는 대부분 확보되었습니다."}`,
      "",
      similarCases.length
        ? `유사 사례: ${similarCases.map(item => `${item.id} ${item.title} (${item.similarity}%)`).join(" / ")}`
        : "유사 사례: 아직 충분히 가까운 사례가 없습니다. Signature를 더 보강하면 검색 품질이 올라갑니다.",
      "",
      `사용한 맥락: ${contextLine}`,
    ].join("\n"),
  };
}
