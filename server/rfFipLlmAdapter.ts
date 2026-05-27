export type LlmProvider = "local" | "gauss" | "openai";

export type LlmTask =
  | "chat-reply"
  | "import-classify"
  | "rca-summary"
  | "signature-normalize"
  | "attachment-analysis";

type SignatureDto = { key: string; value: string; isNew?: boolean };

export interface LlmRequestDto {
  task: LlmTask;
  text?: string;
  context?: Record<string, unknown>;
  signatures?: SignatureDto[];
  materials?: Array<{ type: string; name: string; rows?: string[][]; text?: string }>;
}

export interface LlmResponseDto {
  provider: LlmProvider;
  task: LlmTask;
  result: Record<string, unknown>;
  blocked?: boolean;
}

export class LlmProviderError extends Error {
  readonly provider: LlmProvider;
  readonly status: number;
  readonly missing?: string[];
  readonly blocked?: boolean;

  constructor(provider: LlmProvider, status: number, message: string, options?: { missing?: string[]; blocked?: boolean }) {
    super(message);
    this.name = "LlmProviderError";
    this.provider = provider;
    this.status = status;
    this.missing = options?.missing;
    this.blocked = options?.blocked;
  }
}

export class GaussBlockedError extends LlmProviderError {
  readonly missing: string[];

  constructor(missing: string[]) {
    super("gauss", 501, `Gauss adapter is blocked until required contract inputs are provided: ${missing.join(", ")}`, {
      missing,
      blocked: true,
    });
    this.name = "GaussBlockedError";
    this.missing = missing;
  }
}

function provider(): LlmProvider {
  if (process.env.LLM_PROVIDER === "local") return "local";
  if (process.env.LLM_PROVIDER === "gauss") return "gauss";
  if (process.env.LLM_PROVIDER === "openai") return "openai";
  if (openAiApiKey()) return "openai";
  return "local";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSignatureToken(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[\s_\-./()[\]{}:]+/g, "");
}

function signatureIdentity(signature: { key?: unknown; value?: unknown }): string | undefined {
  if (typeof signature.key !== "string" || typeof signature.value !== "string") return undefined;
  const key = normalizeSignatureToken(signature.key);
  const value = normalizeSignatureToken(signature.value);
  return key && value ? `${key}:${value}` : undefined;
}

function signatureFromUnknown(value: unknown): SignatureDto | undefined {
  if (!isRecord(value) || typeof value.key !== "string" || typeof value.value !== "string") return undefined;
  return { key: value.key, value: value.value, isNew: typeof value.isNew === "boolean" ? value.isNew : undefined };
}

function signaturesFromUnknownArray(value: unknown): SignatureDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const signature = signatureFromUnknown(item);
    return signature ? [signature] : [];
  });
}

function sharedAnalysisSignatures(context?: Record<string, unknown>): SignatureDto[] {
  const sharedContext = context?.sharedAnalysisContext;
  if (!isRecord(sharedContext)) return [];
  return signaturesFromUnknownArray(sharedContext.signatures);
}

function existingSignatures(request: LlmRequestDto): SignatureDto[] {
  return [...(request.signatures ?? []), ...sharedAnalysisSignatures(request.context)];
}

function existingSignatureIdentitySet(request: LlmRequestDto): Set<string> {
  return new Set(existingSignatures(request).flatMap(item => {
    const identity = signatureIdentity(item);
    return identity ? [identity] : [];
  }));
}

function filterNewSignatures(candidates: unknown, request: LlmRequestDto): SignatureDto[] {
  const seen = existingSignatureIdentitySet(request);
  const filtered: SignatureDto[] = [];
  for (const candidate of signaturesFromUnknownArray(candidates)) {
    const identity = signatureIdentity(candidate);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    filtered.push({ ...candidate, isNew: candidate.isNew ?? true });
  }
  return filtered;
}

function enforceSignatureDedupe(result: Record<string, unknown>, request: LlmRequestDto): Record<string, unknown> {
  return {
    ...result,
    ...(Array.isArray(result.extractedTags) ? { extractedTags: filterNewSignatures(result.extractedTags, request) } : {}),
    ...(Array.isArray(result.signatures) ? { signatures: filterNewSignatures(result.signatures, request) } : {}),
  };
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

function openAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1";
}

function openAiEndpoint(): string {
  return process.env.OPENAI_API_URL?.trim() || "https://api.openai.com/v1/responses";
}

function openAiTimeoutMs(): number {
  const parsed = Number(process.env.OPENAI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
}

function openAiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env["open-ai-api-key"];
}

const RF_KNOWLEDGE_CONTEXT = {
  purpose: "Reference guidance only. Use measured evidence and local evidence packets as the source of truth.",
  principles: [
    "Separate conducted baseline from OTA path before blaming antenna or mechanical structures.",
    "For Tx-correlated desense, ask for Tx power sweep, band/channel sweep, and IM or harmonic frequency mapping.",
    "Pressure, reassembly, shield, clip, screw, spring, and contact clues increase mechanical contact or PIM suspicion.",
    "Function ON/OFF clues from display, MIPI, camera, USB, DDR, PMIC, or DC-DC increase internal spur suspicion.",
    "Missing measurements must be returned as missingInfo or next actions; do not invent measurements or pass/fail results.",
  ],
  signaturePolicy: [
    "Signatures are compact evidence tags, not narrative text.",
    "Prefer canonical key/value pairs already used by the app when possible.",
    "Never return a signature already present in input.signatures or context.sharedAnalysisContext.signatures.",
  ],
};

function buildExistingSignatureGuard(request: LlmRequestDto): Record<string, unknown> {
  return {
    rule: "Return only signatures that are new versus input.signatures and context.sharedAnalysisContext.signatures.",
    duplicatePolicy: "If a candidate has the same normalized key and value as an existing signature, omit it from extractedTags and signatures.",
    existingSignatures: existingSignatures(request),
  };
}

function buildOpenAiInstructions(task: LlmTask): string {
  return [
    "You are an RF-FIP analysis assistant for RF desense, PIM, OTA, conducted, and signature triage.",
    "Return concise Korean engineering language unless the input is English.",
    "Always return JSON matching the requested task shape.",
    `Current task: ${task}.`,
    "Use rfKnowledgeContext as reference guidance only; measured user input and local evidence packets are the source of truth.",
    "Do not invent measurements, test outcomes, root causes, or evidence IDs.",
    "For extractedTags and signatures, compare against existingSignatureGuard and return only new key/value pairs.",
    "If an existing signature is relevant, mention it in content, reasons, or rationale instead of repeating it as a new signature.",
    "Do not expose or infer secrets, credentials, or environment variables.",
  ].join("\n");
}

function buildOpenAiInput(request: LlmRequestDto): string {
  return JSON.stringify({
    task: request.task,
    text: request.text ?? "",
    context: request.context ?? {},
    signatures: request.signatures ?? [],
    materials: request.materials ?? [],
    rfKnowledgeContext: RF_KNOWLEDGE_CONTEXT,
    existingSignatureGuard: buildExistingSignatureGuard(request),
    expectedResultByTask: {
      "chat-reply": {
        content: "Actionable RF analysis response",
        extractedTags: [{ key: "Band", value: "B3", isNew: true }],
      },
      "import-classify": {
        status: "candidate | hold",
        score: 0,
        reasons: ["reason"],
        signatures: [{ key: "Band", value: "B3", isNew: true }],
      },
      "rca-summary": {
        draft: {
          rootCause: "most likely root cause",
          diagnosticTests: ["test"],
          rationale: ["evidence"],
        },
      },
      "signature-normalize": {
        signatures: [{ key: "Band", value: "B3", isNew: false }],
      },
      "attachment-analysis": {
        summary: "material analysis summary",
        signatures: [{ key: "Band", value: "B3", isNew: true }],
      },
    }[request.task],
  });
}

function openAiJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: true,
    properties: {
      content: { type: "string" },
      extractedTags: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            value: { type: "string" },
            isNew: { type: "boolean" },
          },
          required: ["key", "value"],
        },
      },
      status: { type: "string" },
      score: { type: "number" },
      reasons: { type: "array", items: { type: "string" } },
      signatures: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            value: { type: "string" },
            isNew: { type: "boolean" },
          },
          required: ["key", "value"],
        },
      },
      draft: {
        type: "object",
        additionalProperties: true,
        properties: {
          rootCause: { type: "string" },
          diagnosticTests: { type: "array", items: { type: "string" } },
          rationale: { type: "array", items: { type: "string" } },
        },
      },
      summary: { type: "string" },
    },
  };
}

function extractOpenAiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as { output_text?: unknown; output?: unknown };
  if (typeof root.output_text === "string") return root.output_text;
  if (!Array.isArray(root.output)) return "";

  const textParts: string[] = [];
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { text?: unknown; type?: unknown };
      if (typeof candidate.text === "string" && (candidate.type === "output_text" || candidate.type === "text")) {
        textParts.push(candidate.text);
      }
    }
  }
  return textParts.join("\n").trim();
}

function parseOpenAiResult(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { content: text };
  } catch {
    return { content: text };
  }
}

async function openAiResult(request: LlmRequestDto): Promise<Record<string, unknown>> {
  const apiKey = openAiApiKey();
  if (!apiKey) {
    throw new LlmProviderError("openai", 501, "OpenAI adapter is blocked until OPENAI_API_KEY is configured.", {
      missing: ["OPENAI_API_KEY"],
      blocked: true,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openAiTimeoutMs());
  try {
    const response = await fetch(openAiEndpoint(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel(),
        instructions: buildOpenAiInstructions(request.task),
        input: buildOpenAiInput(request),
        store: false,
        max_output_tokens: 1200,
        text: {
          format: {
            type: "json_schema",
            name: "rf_fip_llm_result",
            strict: false,
            schema: openAiJsonSchema(),
          },
        },
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      throw new LlmProviderError("openai", status, `OpenAI request failed with status ${response.status}.`);
    }

    const responsePayload = JSON.parse(bodyText) as unknown;
    const outputText = extractOpenAiText(responsePayload);
    if (!outputText) {
      throw new LlmProviderError("openai", 502, "OpenAI response did not include output text.");
    }
    return enforceSignatureDedupe(parseOpenAiResult(outputText), request);
  } catch (error) {
    if (error instanceof LlmProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LlmProviderError("openai", 504, "OpenAI request timed out.");
    }
    throw new LlmProviderError("openai", 502, "OpenAI request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

function localResult(request: LlmRequestDto): Record<string, unknown> {
  const text = request.text ?? "";
  const extracted = filterNewSignatures(extractLocalSignatures(text), request);
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

  if (activeProvider === "openai") {
    return {
      provider: "openai",
      task: request.task,
      result: await openAiResult(request),
    };
  }

  return {
    provider: "local",
    task: request.task,
    result: localResult(request),
  };
}
