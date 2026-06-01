import {
  loadKnowledgeCaseExcerptDocuments,
  loadLocalPublicWikiDocuments,
  retrieveKnowledgeContext,
} from "./rfFipRag";
import { getRfFipDbSnapshot } from "./rfFipStore";

export type RagOpsVerdict = "PASS" | "WARN" | "FAIL";

export interface RagOpsReport {
  verdict: RagOpsVerdict;
  generatedAt: string;
  today: string;
  counts: {
    publicWikiDocuments: number;
    confirmedKnowledgeCases: number;
    knowledgeCaseExcerpts: number;
    nonConfirmedKnowledgeCases: number;
    openAiProbeSnippets: number;
  };
  warnings: string[];
  errors: string[];
  nextActions: string[];
}

interface RagOpsReportOptions {
  failOnWarn?: boolean;
  now?: Date;
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(dateText: string, todayText: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const date = new Date(`${dateText}T00:00:00`);
  const today = new Date(`${todayText}T00:00:00`);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function verdictFrom(errors: string[], warnings: string[], failOnWarn = false): RagOpsVerdict {
  if (errors.length) return "FAIL";
  if (warnings.length) return failOnWarn ? "FAIL" : "WARN";
  return "PASS";
}

export function buildRagOpsReport(options: RagOpsReportOptions = {}): RagOpsReport {
  const now = options.now ?? new Date();
  const today = localIsoDate(now);
  const publicDocs = loadLocalPublicWikiDocuments();
  const knowledgeDocs = loadKnowledgeCaseExcerptDocuments();
  const knowledgeCases = getRfFipDbSnapshot().knowledgeCases ?? [];
  const confirmedKnowledgeCases = knowledgeCases.filter(item => item.status === "confirmed").length;
  const nonConfirmedKnowledgeCases = knowledgeCases.filter(item => item.status !== "confirmed").length;
  const errors: string[] = [];
  const warnings: string[] = [];

  const publicIds = new Set<string>();
  for (const doc of publicDocs) {
    if (publicIds.has(doc.id)) errors.push(`duplicate public wiki id: ${doc.id}`);
    publicIds.add(doc.id);
    if (doc.securityClass !== "public-safe") errors.push(`${doc.id} is not public-safe`);
    if (!doc.allowedProviders.includes("openai")) errors.push(`${doc.id} does not allow OpenAI despite public-safe source`);
    if (!doc.owner) warnings.push(`${doc.id} missing owner`);
    if (!doc.reviewDue) errors.push(`${doc.id} missing reviewDue`);
    const dueIn = doc.reviewDue ? daysUntil(doc.reviewDue, today) : null;
    if (dueIn !== null && dueIn < 0) errors.push(`${doc.id} reviewDue is stale: ${doc.reviewDue}`);
    if (dueIn !== null && dueIn <= 14 && dueIn >= 0) warnings.push(`${doc.id} reviewDue is within ${dueIn} day(s): ${doc.reviewDue}`);
  }

  if (publicDocs.length < 20) errors.push(`public RF Wiki document count below 20: ${publicDocs.length}`);
  if (knowledgeDocs.length !== confirmedKnowledgeCases) {
    errors.push(`Knowledge case excerpt count mismatch: confirmed=${confirmedKnowledgeCases}, excerpts=${knowledgeDocs.length}`);
  }

  const knowledgeIds = new Set<string>();
  for (const doc of knowledgeDocs) {
    if (knowledgeIds.has(doc.id)) errors.push(`duplicate Knowledge case excerpt id: ${doc.id}`);
    knowledgeIds.add(doc.id);
    if (doc.sourceType !== "knowledge-case-excerpt") errors.push(`${doc.id} has invalid sourceType: ${doc.sourceType}`);
    if (doc.sourceStatus !== "confirmed") errors.push(`${doc.id} sourceStatus must be confirmed`);
    if (doc.securityClass !== "internal-only") errors.push(`${doc.id} must be internal-only`);
    if (doc.allowedProviders.includes("openai")) errors.push(`${doc.id} must not allow OpenAI by default`);
    if (!doc.allowedProviders.includes("local") || !doc.allowedProviders.includes("gauss")) {
      errors.push(`${doc.id} must allow local and gauss providers`);
    }
    if (/https?:\/\//i.test(doc.body)) errors.push(`${doc.id} excerpt includes URL-like raw material`);
    if (!doc.signatureKeys.length) warnings.push(`${doc.id} has no signature keys; retrieval quality may be weak`);
  }

  const openAiProbe = retrieveKnowledgeContext({
    provider: "openai",
    task: "chat-reply",
    text: "Back Glass pressure desense conducted normal OTA TIS fail PMIC DCDC spur",
    signatures: [
      { key: "Contact Structure", value: "Back Glass" },
      { key: "Conducted Result", value: "Normal" },
      { key: "OTA Result", value: "Fail" },
    ],
    maxSnippets: 8,
  });
  if (openAiProbe.snippets.some(item => item.sourceType === "knowledge-case-excerpt" || item.securityClass !== "public-safe")) {
    errors.push("OpenAI retrieval leaked non-public RAG snippet");
  }

  return {
    verdict: verdictFrom(errors, warnings, options.failOnWarn),
    generatedAt: now.toISOString(),
    today,
    counts: {
      publicWikiDocuments: publicDocs.length,
      confirmedKnowledgeCases,
      knowledgeCaseExcerpts: knowledgeDocs.length,
      nonConfirmedKnowledgeCases,
      openAiProbeSnippets: openAiProbe.snippets.length,
    },
    warnings,
    errors,
    nextActions: [
      ...(errors.length ? ["Fix FAIL items before trusting RAG output."] : []),
      ...(warnings.length ? ["Review WARN items before the next release or scheduled maintenance window."] : []),
      "Run smoke:rag-maintenance, smoke:rag-contract, and smoke:knowledge-case-rag after RAG source edits.",
      "Keep Knowledge DB public-safe promotion and internal Gauss Wiki connector as separate reviewed phases.",
    ],
  };
}
