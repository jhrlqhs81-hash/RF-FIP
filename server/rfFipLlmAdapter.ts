export type LlmProvider = "local" | "gauss";

export type LlmTask =
  | "chat-reply"
  | "import-classify"
  | "rca-summary"
  | "signature-normalize"
  | "attachment-analysis";

export interface LlmRequestDto {
  task: LlmTask;
  text?: string;
  context?: Record<string, unknown>;
  signatures?: Array<{ key: string; value: string; isNew?: boolean }>;
  materials?: Array<{ type: string; name: string; rows?: string[][]; text?: string }>;
}

export interface LlmResponseDto {
  provider: LlmProvider;
  task: LlmTask;
  result: Record<string, unknown>;
  blocked?: boolean;
}

export class GaussBlockedError extends Error {
  readonly status = 501;
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Gauss adapter is blocked until required contract inputs are provided: ${missing.join(", ")}`);
    this.name = "GaussBlockedError";
    this.missing = missing;
  }
}

function provider(): LlmProvider {
  return process.env.LLM_PROVIDER === "gauss" ? "gauss" : "local";
}

function requiredGaussGaps(): string[] {
  const missing: string[] = [];
  if (!process.env.GAUSS_API_URL) missing.push("GAUSS_API_URL");
  if (!process.env.GAUSS_API_KEY) missing.push("GAUSS_API_KEY");
  missing.push("request JSON schema");
  missing.push("response JSON schema");
  missing.push("file upload support contract");
  missing.push("timeout/error rules");
  return missing;
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function extractLocalSignatures(text: string): Array<{ key: string; value: string; isNew: true }> {
  const signatures: Array<{ key: string; value: string; isNew: true }> = [];
  const add = (key: string, value?: string) => {
    if (!value) return;
    if (!signatures.some(item => item.key.toLowerCase() === key.toLowerCase() && item.value.toLowerCase() === value.toLowerCase())) {
      signatures.push({ key, value, isNew: true });
    }
  };

  const band = /\b((?:B|n)\d{1,3})\b/i.exec(text)?.[1];
  add("Band", band?.toUpperCase());

  const degradation = /(\d+(?:\.\d+)?)\s*dB(?!m)/i.exec(text)?.[1];
  add("Degradation (dB)", degradation ? `${degradation}dB` : undefined);

  const txPower = /(?:tx|ul|transmit|power)[^\d]{0,16}(\d+(?:\.\d+)?)\s*dBm/i.exec(text)?.[1];
  add("Tx Power", txPower ? `${txPower}dBm` : undefined);
  if (/tx|ul|dBm|pim|im3|im5/i.test(text)) add("Tx Correlated", "True");
  if (/conducted|cable/i.test(text)) add("Conducted Result", /normal|pass/i.test(text) ? "Normal" : "Check required");
  if (/ota|tis|eis|chamber/i.test(text)) add("OTA Result", /fail|degrad|drop/i.test(text) ? "Fail" : "Check required");
  if (/im3|im5|pim|intermod/i.test(text)) add("Desense Category", "TX-induced PIM Desense");
  if (/display|mipi|camera|usb|ddr|pmic|dcdc|dc-dc/i.test(text)) add("Desense Category", "Internal Desense / Spurious");
  if (/shield|clip|screw|spring|bracket|contact/i.test(text)) add("Contact Structure", "Mechanical Contact");

  return signatures;
}

function classifyLocal(text: string, signatures: Array<{ key: string; value: string }>) {
  const haystack = `${text} ${signatures.map(item => `${item.key} ${item.value}`).join(" ")}`.toLowerCase();
  if (/pim|im3|im5|intermod|contact|shield|clip/.test(haystack)) {
    return {
      category: "TX-induced PIM Desense",
      mechanism: "Contact nonlinearity or intermodulation product",
      diagnosticTests: ["Tx power sweep", "IM3/IM5 frequency check", "Pressure/contact A/B test"],
    };
  }
  if (/display|mipi|pmic|dcdc|spur|harmonic/.test(haystack)) {
    return {
      category: "Internal Desense / Spurious",
      mechanism: "Internal high-speed or power noise coupling into Rx path",
      diagnosticTests: ["Function ON/OFF A/B", "Near-field scan", "Harmonic frequency map"],
    };
  }
  return {
    category: "RF Desense Triage",
    mechanism: "Insufficient evidence for a narrower local classification",
    diagnosticTests: ["Conducted baseline", "OTA reproduction", "Band/channel sweep"],
  };
}

function localResult(request: LlmRequestDto): Record<string, unknown> {
  const text = request.text ?? "";
  const extracted = extractLocalSignatures(text);
  const signatures = uniq([...(request.signatures ?? []), ...extracted].map(item => `${item.key}|||${item.value}`))
    .map(item => {
      const [key, value] = item.split("|||");
      return { key, value, isNew: extracted.some(sig => sig.key === key && sig.value === value) };
    });
  const classification = classifyLocal(text, signatures);

  if (request.task === "chat-reply") {
    return {
      content: [
        `Local provider classification: ${classification.category}`,
        `Mechanism: ${classification.mechanism}`,
        `Next checks: ${classification.diagnosticTests.join(", ")}`,
      ].join("\n"),
      extractedTags: extracted,
    };
  }

  if (request.task === "import-classify") {
    return {
      status: text && (extracted.length >= 2 || /desense|sensitivity|rx|tx|pim|band|db/i.test(text)) ? "candidate" : "hold",
      score: Math.min(94, 30 + extracted.length * 9),
      reasons: [`${extracted.length} local RF signatures extracted`, classification.category],
      signatures: extracted,
    };
  }

  if (request.task === "rca-summary") {
    return {
      draft: {
        rootCause: classification.mechanism,
        diagnosticTests: classification.diagnosticTests,
        rationale: [`Local deterministic provider only`, `Category: ${classification.category}`],
      },
    };
  }

  if (request.task === "signature-normalize") {
    return { signatures };
  }

  return {
    summary: request.materials?.length
      ? `Local attachment analysis received ${request.materials.length} material(s).`
      : "No analyzable attachment material was provided.",
    signatures: extracted,
  };
}

export async function runRfFipLlm(request: LlmRequestDto): Promise<LlmResponseDto> {
  const activeProvider = provider();
  if (activeProvider === "gauss") {
    throw new GaussBlockedError(requiredGaussGaps());
  }

  return {
    provider: "local",
    task: request.task,
    result: localResult(request),
  };
}
