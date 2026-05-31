import fs from "node:fs";
import path from "node:path";
import type { LlmProvider, LlmTask } from "./rfFipLlmAdapter";
import { getRfFipDbSnapshot } from "./rfFipStore";

export type RagSourceType = "local-public" | "local-internal" | "gauss-internal-wiki" | "knowledge-case-excerpt";
export type RagSecurityClass = "public-safe" | "internal-only" | "restricted";

export interface RagSnippet {
  id: string;
  title: string;
  sourceType: RagSourceType;
  securityClass: RagSecurityClass;
  allowedProviders: LlmProvider[];
  matchedConceptIds: string[];
  matchedSignatureKeys: string[];
  score: number;
  excerpt: string;
  sourcePath?: string;
  sourceUrl?: string;
  version?: string;
  updatedAt?: string;
  owner?: string;
  reviewDue?: string;
  deprecated?: boolean;
  sourceCaseId?: string;
  sourceKind?: "wiki" | "knowledge-case-excerpt";
  sourceStatus?: string;
}

export interface RetrievedKnowledgeContext {
  policy: {
    sourceOfTruth: "localEvidencePacket";
    referenceOnly: true;
    providerFiltered: true;
    appliedTasks: LlmTask[];
  };
  snippets: RagSnippet[];
  filteredCount: number;
  blockedReasons: string[];
}

interface RagDocument {
  id: string;
  title: string;
  sourceType: RagSourceType;
  securityClass: RagSecurityClass;
  allowedProviders: LlmProvider[];
  conceptIds: string[];
  signatureKeys: string[];
  body: string;
  sourcePath?: string;
  version?: string;
  updatedAt?: string;
  owner?: string;
  reviewDue?: string;
  deprecated?: boolean;
  sourceCaseId?: string;
  sourceKind?: "wiki" | "knowledge-case-excerpt";
  sourceStatus?: string;
}

interface RagQueryInput {
  provider: LlmProvider;
  task: LlmTask;
  text?: string;
  context?: Record<string, unknown>;
  signatures?: Array<{ key: string; value: string }>;
  maxSnippets?: number;
}

const RAG_APPLIED_TASKS: LlmTask[] = ["chat-reply", "rca-summary"];

interface KnowledgeCaseSnapshotItem {
  id: string;
  title: string;
  status: "confirmed" | "validated";
  symptomPattern?: string;
  confirmedRootCause?: string;
  mitigation?: string;
  diagnosticTests?: string[];
  lessonsLearned?: string;
  decisionRationale?: string[];
  signatures?: Array<{ key: string; value: string }>;
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s_\-./()[\]{}:]+/g, "");
}

function normalizedParts(value: string): string[] {
  return value.split(/[^A-Za-z0-9]+/).map(normalize).filter(token => token.length >= 2);
}

function splitList(value: string | undefined): string[] {
  return (value ?? "").split(",").map(item => item.trim()).filter(Boolean);
}

function asProvider(value: string): LlmProvider | undefined {
  return value === "local" || value === "openai" || value === "gauss" ? value : undefined;
}

function parseFrontMatter(content: string): { meta: Record<string, string>; body: string } {
  if (!content.startsWith("---")) return { meta: {}, body: content.trim() };
  const end = content.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: content.trim() };
  const rawMeta = content.slice(3, end).trim();
  const body = content.slice(end + 4).trim();
  const meta: Record<string, string> = {};
  for (const line of rawMeta.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body };
}

function projectRoot(): string {
  return process.cwd();
}

function wikiDir(): string {
  return process.env.RF_FIP_RAG_WIKI_DIR
    ? path.resolve(process.env.RF_FIP_RAG_WIKI_DIR)
    : path.join(projectRoot(), "docs", "rf-wiki");
}

function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysIso(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

export function gaussInternalWikiBlockedReasons(): string[] {
  const missing: string[] = [];
  if (!process.env.GAUSS_WIKI_API_URL) missing.push("GAUSS_WIKI_API_URL");
  if (!process.env.GAUSS_WIKI_API_KEY) missing.push("GAUSS_WIKI_API_KEY");
  missing.push("wiki search request schema");
  missing.push("wiki search response schema");
  missing.push("document security classification rule");
  return missing.map(item => `gauss-internal-wiki blocked: missing ${item}`);
}

export function loadLocalPublicWikiDocuments(): RagDocument[] {
  const dir = wikiDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith(".md"))
    .map(file => {
      const sourcePath = path.join(dir, file);
      const { meta, body } = parseFrontMatter(fs.readFileSync(sourcePath, "utf8"));
      return {
        id: meta.id || path.basename(file, ".md"),
        title: meta.title || path.basename(file, ".md"),
        sourceType: (meta.sourceType as RagSourceType) || "local-public",
        securityClass: (meta.securityClass as RagSecurityClass) || "public-safe",
        allowedProviders: splitList(meta.allowedProviders).flatMap(item => {
          const provider = asProvider(item);
          return provider ? [provider] : [];
        }),
        conceptIds: splitList(meta.conceptIds),
        signatureKeys: splitList(meta.signatureKeys),
        body,
        sourcePath: path.relative(projectRoot(), sourcePath).replace(/\\/g, "/"),
        version: meta.version,
        updatedAt: meta.updatedAt,
        owner: meta.owner,
        reviewDue: meta.reviewDue,
        deprecated: meta.deprecated === "true",
        sourceKind: "wiki" as const,
      };
    })
    .filter(doc => doc.sourceType === "local-public" && doc.securityClass === "public-safe");
}

function safeLine(label: string, value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return `${label}: ${value.trim()}`;
  if (Array.isArray(value)) {
    const items = value.filter(item => typeof item === "string" && item.trim()).map(item => item.trim());
    return items.length ? `${label}: ${items.join("; ")}` : undefined;
  }
  return undefined;
}

function knowledgeCaseBody(item: KnowledgeCaseSnapshotItem): string {
  const signatureText = (item.signatures ?? [])
    .filter(signature => signature.key?.trim() && signature.value?.trim())
    .map(signature => `${signature.key.trim()}=${signature.value.trim()}`);
  return [
    safeLine("symptom pattern", item.symptomPattern),
    safeLine("decisive evidence", item.decisionRationale),
    safeLine("confirmed root cause", item.confirmedRootCause),
    safeLine("diagnostic tests", item.diagnosticTests),
    safeLine("mitigation", item.mitigation),
    safeLine("lessons learned", item.lessonsLearned),
    signatureText.length ? `signatures: ${signatureText.join("; ")}` : undefined,
  ].filter(Boolean).join("\n");
}

export function loadKnowledgeCaseExcerptDocuments(): RagDocument[] {
  const updatedAt = localIsoDate();
  const reviewDue = addDaysIso(updatedAt, 90);
  return (getRfFipDbSnapshot().knowledgeCases as KnowledgeCaseSnapshotItem[])
    .filter(item => item.status === "confirmed")
    .map(item => {
      const body = knowledgeCaseBody(item);
      return {
        id: `knowledge-case-${item.id}`,
        title: `Knowledge Case: ${item.title}`,
        sourceType: "knowledge-case-excerpt" as const,
        securityClass: "internal-only" as const,
        allowedProviders: ["local", "gauss"] as LlmProvider[],
        conceptIds: ["knowledge.case", "knowledge.confirmed_case"],
        signatureKeys: Array.from(new Set((item.signatures ?? []).map(signature => signature.key).filter(Boolean))),
        body,
        owner: "knowledge-db",
        updatedAt,
        reviewDue,
        sourceCaseId: item.id,
        sourceKind: "knowledge-case-excerpt" as const,
        sourceStatus: item.status,
      };
    })
    .filter(doc => doc.body.length > 0);
}

function contextTokens(context?: Record<string, unknown>): string[] {
  const tokens: string[] = [];
  const localEvidencePacket = context?.localEvidencePacket;
  if (localEvidencePacket && typeof localEvidencePacket === "object") {
    const packet = localEvidencePacket as {
      classification?: unknown;
      extractedTags?: unknown;
      mergedSignatures?: unknown;
      conceptRelationHints?: unknown;
      missingInfo?: unknown;
    };
    if (typeof packet.classification === "string") tokens.push(packet.classification);
    for (const key of ["extractedTags", "mergedSignatures"] as const) {
      if (!Array.isArray(packet[key])) continue;
      for (const item of packet[key]) {
        if (!item || typeof item !== "object") continue;
        const tag = item as { key?: unknown; value?: unknown };
        if (typeof tag.key === "string") tokens.push(tag.key);
        if (typeof tag.value === "string") tokens.push(tag.value);
      }
    }
    if (Array.isArray(packet.conceptRelationHints)) {
      for (const item of packet.conceptRelationHints) {
        if (!item || typeof item !== "object") continue;
        const hint = item as { sourceConceptId?: unknown; targetConceptId?: unknown; targetKey?: unknown; targetValue?: unknown };
        for (const value of [hint.sourceConceptId, hint.targetConceptId, hint.targetKey, hint.targetValue]) {
          if (typeof value === "string") tokens.push(value);
        }
      }
    }
    if (Array.isArray(packet.missingInfo)) {
      for (const item of packet.missingInfo) if (typeof item === "string") tokens.push(item);
    }
  }

  const sharedAnalysisContext = context?.sharedAnalysisContext;
  if (sharedAnalysisContext && typeof sharedAnalysisContext === "object") {
    const shared = sharedAnalysisContext as { weightedSignatureContext?: unknown; signatures?: unknown };
    if (Array.isArray(shared.weightedSignatureContext)) {
      for (const item of shared.weightedSignatureContext) {
        if (!item || typeof item !== "object") continue;
        const record = item as { conceptId?: unknown; valueId?: unknown; conceptPath?: unknown; canonicalKey?: unknown; canonicalValue?: unknown };
        for (const value of [record.conceptId, record.valueId, record.conceptPath, record.canonicalKey, record.canonicalValue]) {
          if (typeof value === "string") tokens.push(value);
        }
      }
    }
    if (Array.isArray(shared.signatures)) {
      for (const item of shared.signatures) {
        if (!item || typeof item !== "object") continue;
        const tag = item as { key?: unknown; value?: unknown };
        if (typeof tag.key === "string") tokens.push(tag.key);
        if (typeof tag.value === "string") tokens.push(tag.value);
      }
    }
  }
  return tokens;
}

function queryTokens(input: RagQueryInput): string[] {
  const tokens = [
    input.text ?? "",
    ...(input.signatures ?? []).flatMap(item => [item.key, item.value]),
    ...contextTokens(input.context),
  ];
  return Array.from(new Set(tokens.flatMap(token => token.split(/[^A-Za-z0-9가-힣_.+-]+/)).map(normalize).filter(token => token.length >= 2)));
}

function providerAllows(doc: RagDocument, provider: LlmProvider): boolean {
  if (!doc.allowedProviders.includes(provider)) return false;
  if (provider === "openai") return doc.securityClass === "public-safe";
  if (provider === "gauss") return doc.securityClass === "public-safe" || doc.securityClass === "internal-only";
  if (provider === "local") {
    if (doc.sourceType === "local-public") return doc.securityClass === "public-safe";
    return doc.sourceType === "knowledge-case-excerpt" && doc.securityClass === "internal-only";
  }
  return false;
}

function documentScore(doc: RagDocument, tokens: string[]): { score: number; matchedConceptIds: string[]; matchedSignatureKeys: string[] } {
  const haystack = normalize([doc.title, doc.body, doc.conceptIds.join(" "), doc.signatureKeys.join(" ")].join(" "));
  const tokenSet = new Set(tokens);
  const conceptMatches = doc.conceptIds.filter(id => tokenSet.has(normalize(id)) || normalizedParts(id).some(part => tokenSet.has(part)));
  const signatureMatches = doc.signatureKeys.filter(key => tokenSet.has(normalize(key)) || normalizedParts(key).some(part => tokenSet.has(part)));
  const textMatches = tokens.filter(token => haystack.includes(token));
  const score = conceptMatches.length * 3 + signatureMatches.length * 2 + Math.min(textMatches.length, 10) * 0.3;
  return { score, matchedConceptIds: conceptMatches, matchedSignatureKeys: signatureMatches };
}

function excerpt(body: string, maxLength = 520): string {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 3)}...`;
}

export function retrieveKnowledgeContext(input: RagQueryInput): RetrievedKnowledgeContext {
  const blockedReasons = gaussInternalWikiBlockedReasons();
  if (!RAG_APPLIED_TASKS.includes(input.task)) {
    return {
      policy: { sourceOfTruth: "localEvidencePacket", referenceOnly: true, providerFiltered: true, appliedTasks: RAG_APPLIED_TASKS },
      snippets: [],
      filteredCount: 0,
      blockedReasons,
    };
  }

  const tokens = queryTokens(input);
  const scored = [...loadLocalPublicWikiDocuments(), ...loadKnowledgeCaseExcerptDocuments()]
    .map(doc => ({ doc, ...documentScore(doc, tokens) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const allowed = scored.filter(item => providerAllows(item.doc, input.provider));
  const maxSnippets = input.maxSnippets ?? 4;
  const snippets: RagSnippet[] = allowed.slice(0, maxSnippets).map(item => ({
    id: item.doc.id,
    title: item.doc.title,
    sourceType: item.doc.sourceType,
    securityClass: item.doc.securityClass,
    allowedProviders: item.doc.allowedProviders,
    matchedConceptIds: item.matchedConceptIds,
    matchedSignatureKeys: item.matchedSignatureKeys,
    score: Number(item.score.toFixed(3)),
    excerpt: excerpt(item.doc.body),
    sourcePath: item.doc.sourcePath,
    version: item.doc.version,
    updatedAt: item.doc.updatedAt,
    owner: item.doc.owner,
    reviewDue: item.doc.reviewDue,
    deprecated: item.doc.deprecated,
    sourceCaseId: item.doc.sourceCaseId,
    sourceKind: item.doc.sourceKind,
    sourceStatus: item.doc.sourceStatus,
  }));

  return {
    policy: { sourceOfTruth: "localEvidencePacket", referenceOnly: true, providerFiltered: true, appliedTasks: RAG_APPLIED_TASKS },
    snippets,
    filteredCount: scored.length - snippets.length,
    blockedReasons,
  };
}
