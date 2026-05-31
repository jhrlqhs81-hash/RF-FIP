import type { Issue, SignatureTag } from "./mockData";
import type { SignatureAliasEntry } from "./signatureAliasResolver";
import type { KnowledgeCase } from "./similarCasesDb";
import type { SignatureWeightRule } from "./signatureWeights";

export interface ImportApprovalRecord {
  id: string;
  createdAt: string;
  sourceFileNames: string[];
  approvedCaseIds: string[];
  skippedDuplicateCaseIds: string[];
  heldCount: number;
  candidateCount: number;
}

export interface RfFipDbSnapshot {
  issues: Issue[];
  knowledgeCases: KnowledgeCase[];
  signatureDictionary: SignatureTag[];
  signatureAliasDictionary: SignatureAliasEntry[];
  signatureWeightRules: SignatureWeightRule[];
  importResults: ImportApprovalRecord[];
  persistenceAvailable?: boolean;
}

export type RfFipLlmTask =
  | "chat-reply"
  | "import-classify"
  | "rca-summary"
  | "signature-normalize"
  | "attachment-analysis";

export interface RfFipLlmResponse {
  provider: "local" | "gauss" | "openai";
  task: RfFipLlmTask;
  result: Record<string, unknown>;
  blocked?: boolean;
}

export interface RagOpsReport {
  verdict: "PASS" | "WARN" | "FAIL";
  generatedAt: string;
  today: string;
  counts: {
    publicWikiDocuments: number;
    knowledgeCaseExcerpts: number;
    openAiProbeSnippets: number;
  };
  warnings: string[];
  errors: string[];
  nextActions: string[];
}

class PersistenceApiUnavailableError extends Error {
  constructor(path: string) {
    super(`Persistence API unavailable at ${path}`);
    this.name = "PersistenceApiUnavailableError";
  }
}

export class RfFipApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(path: string, status: number, payload: unknown, fallbackMessage: string) {
    super(fallbackMessage || `Request failed: ${status} at ${path}`);
    this.name = "RfFipApiError";
    this.status = status;
    this.payload = payload;
  }
}

const EMPTY_SNAPSHOT: RfFipDbSnapshot = {
  issues: [],
  knowledgeCases: [],
  signatureDictionary: [],
  signatureAliasDictionary: [],
  signatureWeightRules: [],
  importResults: [],
  persistenceAvailable: false,
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const contentType = response.headers.get("Content-Type") ?? "";
  const bodyText = await response.text();
  const isHtmlFallback = contentType.includes("text/html") || /^\s*<!doctype html/i.test(bodyText) || /^\s*<html/i.test(bodyText);
  if (response.status === 404 || isHtmlFallback) {
    throw new PersistenceApiUnavailableError(path);
  }
  if (!response.ok) {
    let payload: unknown = bodyText;
    let message = bodyText || `Request failed: ${response.status} at ${path}`;
    try {
      payload = JSON.parse(bodyText);
      if (payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string") {
        message = (payload as { error: string }).error;
      }
    } catch {
      /* keep text body */
    }
    throw new RfFipApiError(path, response.status, payload, message);
  }
  return JSON.parse(bodyText) as T;
}

export async function loadRfFipDb(): Promise<RfFipDbSnapshot> {
  try {
    await requestJson<{ ok: true }>("/api/health");
    const [issues, knowledgeCases, signatureDictionary, signatureAliasDictionary, signatureWeightRules, importResults] = await Promise.all([
      requestJson<{ items: Issue[] }>("/api/issues").then((payload) => payload.items),
      requestJson<{ items: KnowledgeCase[] }>("/api/knowledge-cases").then((payload) => payload.items),
      requestJson<{ items: SignatureTag[] }>("/api/signature-dictionary").then((payload) => payload.items),
      requestJson<{ items: SignatureAliasEntry[] }>("/api/signature-aliases").then((payload) => payload.items),
      requestJson<{ items: SignatureWeightRule[] }>("/api/signature-weight-rules").then((payload) => payload.items),
      requestJson<{ items: ImportApprovalRecord[] }>("/api/import-results").then((payload) => payload.items),
    ]);

    return { issues, knowledgeCases, signatureDictionary, signatureAliasDictionary, signatureWeightRules, importResults, persistenceAvailable: true };
  } catch (error) {
    if (error instanceof PersistenceApiUnavailableError || error instanceof TypeError) {
      console.info("RF-FIP persistence API is unavailable; using bundled mock data for this session.");
      return EMPTY_SNAPSHOT;
    }
    throw error;
  }
}

export async function saveIssue(item: Issue): Promise<Issue> {
  const payload = await requestJson<{ item: Issue }>("/api/issues", {
    method: "POST",
    body: JSON.stringify(item),
  });
  return payload.item;
}

export async function replaceIssues(items: Issue[]): Promise<Issue[]> {
  try {
    const payload = await requestJson<{ items: Issue[] }>("/api/issues", {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    return payload.items;
  } catch (error) {
    if (error instanceof PersistenceApiUnavailableError || error instanceof TypeError) {
      console.info("RF-FIP persistence API is unavailable; issue removal is session-only.");
      return items;
    }
    throw error;
  }
}

export async function saveKnowledgeCase(item: KnowledgeCase): Promise<KnowledgeCase> {
  const payload = await requestJson<{ item: KnowledgeCase }>("/api/knowledge-cases", {
    method: "POST",
    body: JSON.stringify(item),
  });
  return payload.item;
}

export async function saveSignatureDictionary(items: SignatureTag[]): Promise<SignatureTag[]> {
  const payload = await requestJson<{ items: SignatureTag[] }>("/api/signature-dictionary", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
  return payload.items;
}

export async function saveSignatureAliases(items: SignatureAliasEntry[]): Promise<SignatureAliasEntry[]> {
  const payload = await requestJson<{ items: SignatureAliasEntry[] }>("/api/signature-aliases", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
  return payload.items;
}

export async function saveSignatureWeightRules(items: SignatureWeightRule[]): Promise<SignatureWeightRule[]> {
  const payload = await requestJson<{ items: SignatureWeightRule[] }>("/api/signature-weight-rules", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
  return payload.items;
}

export async function saveImportApproval(item: ImportApprovalRecord): Promise<ImportApprovalRecord> {
  const payload = await requestJson<{ item: ImportApprovalRecord }>("/api/import-results", {
    method: "POST",
    body: JSON.stringify(item),
  });
  return payload.item;
}

export async function runRfFipLlm(task: RfFipLlmTask, payload: Record<string, unknown>): Promise<RfFipLlmResponse> {
  return requestJson<RfFipLlmResponse>(`/api/llm/${task}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadRagOpsReport(): Promise<RagOpsReport> {
  const payload = await requestJson<{ report: RagOpsReport }>("/api/rag/ops-report");
  return payload.report;
}

export { persistableAttachment } from "./attachmentPersistence";
