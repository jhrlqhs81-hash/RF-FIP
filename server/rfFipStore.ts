import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

interface PersistedSignature {
  key: string;
  value: string;
  isNew?: boolean;
}

interface PersistedSignatureWeightRule {
  id: string;
  signatureKey: string;
  analysisWeight: number;
  retrievalWeight: number;
  workflowWeight: number;
  enabled: boolean;
  reason: string;
  operationRule: string;
  updatedAt: string;
}

interface PersistedSignatureAliasEntry {
  id?: string;
  canonicalKey: string;
  canonicalValue: string;
  aliases: string[];
  domain: "rf" | "mechanical" | "test" | "source" | "workflow";
  status?: "approved" | "pending";
  confidence?: number;
  source?: "builtin" | "user-approved" | "imported";
  conceptId?: string;
  valueId?: string;
  aliasType?: "synonym" | "abbreviation" | "translation" | "spelling_variant" | "semantic_alias";
  relationType?: "synonym" | "alias" | "abbreviation" | "translation" | "spelling_variant" | "semantic_alias" | "related_to" | "parent_of" | "child_of" | "caused_by" | "measured_by" | "condition_of" | "reject";
  sourceDocId?: string;
  approvedBy?: string;
  note?: string;
  scope?: string;
}

interface PersistedAttachment {
  id: string;
  type: "image" | "table" | "url" | "file";
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  rows?: string[][];
}

interface PersistedKnowledgeCase {
  id: string;
  title: string;
  model: string;
  band: string;
  status: "confirmed" | "validated";
  confirmedRootCause: string;
  mitigation: string;
  symptomPattern?: string;
  diagnosticTests?: string[];
  suspectedStructures?: string[];
  lessonsLearned?: string;
  decisionRationale?: string[];
  usedMaterials?: PersistedAttachment[];
  signatures: PersistedSignature[];
  similarity?: number;
}

interface PersistedImportResult {
  id: string;
  createdAt: string;
  sourceFileNames: string[];
  approvedCaseIds: string[];
  skippedDuplicateCaseIds: string[];
  heldCount: number;
  candidateCount: number;
}

interface PersistedIssue {
  id: string;
  title: string;
  model: string;
  status: string;
  band: string;
  createdAt: string;
  assignee: string;
  messages: unknown[];
  signatures: PersistedSignature[];
  hypotheses: unknown[];
  chatSummary?: unknown;
}

interface RfFipDb {
  issues: PersistedIssue[];
  knowledgeCases: PersistedKnowledgeCase[];
  signatureDictionary: PersistedSignature[];
  signatureAliasDictionary: PersistedSignatureAliasEntry[];
  signatureWeightRules: PersistedSignatureWeightRule[];
  importResults: PersistedImportResult[];
}

const EMPTY_DB: RfFipDb = {
  issues: [],
  knowledgeCases: [],
  signatureDictionary: [],
  signatureAliasDictionary: [],
  signatureWeightRules: [],
  importResults: [],
};

const COLLECTION_NAMES = ["issues", "knowledgeCases", "signatureDictionary", "signatureAliasDictionary", "signatureWeightRules", "importResults"] as const;
type CollectionName = typeof COLLECTION_NAMES[number];

const dbDir = process.env.RF_FIP_DB_DIR
  ? path.resolve(process.env.RF_FIP_DB_DIR)
  : path.resolve(process.cwd(), ".rf-fip-db");

const sqlitePath = path.join(dbDir, "rf-fip.sqlite");
const legacyJsonPath = path.join(dbDir, "rf-fip.json");

let db: DatabaseSync | null = null;
let initialized = false;
let migratedFromJson = false;

function ensureDbDir() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function parseLegacyJson(): RfFipDb | null {
  if (!fs.existsSync(legacyJsonPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(legacyJsonPath, "utf-8")) as Partial<RfFipDb>;
    return {
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      knowledgeCases: Array.isArray(parsed.knowledgeCases) ? parsed.knowledgeCases : [],
      signatureDictionary: Array.isArray(parsed.signatureDictionary) ? parsed.signatureDictionary : [],
      signatureAliasDictionary: Array.isArray(parsed.signatureAliasDictionary) ? parsed.signatureAliasDictionary : [],
      signatureWeightRules: Array.isArray(parsed.signatureWeightRules) ? parsed.signatureWeightRules : [],
      importResults: Array.isArray(parsed.importResults) ? parsed.importResults : [],
    };
  } catch {
    return null;
  }
}

function getDb(): DatabaseSync {
  ensureDbDir();
  if (!db) db = new DatabaseSync(sqlitePath);
  if (!initialized) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rf_fip_collections (
        name TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    migrateLegacyJsonIfNeeded(db);
    initialized = true;
  }
  return db;
}

function migrateLegacyJsonIfNeeded(database: DatabaseSync) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM rf_fip_collections").get() as { count: number };
  if (row.count > 0) return;
  const legacy = parseLegacyJson();
  if (!legacy) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const name of COLLECTION_NAMES) {
      database.prepare(`
        INSERT OR REPLACE INTO rf_fip_collections (name, payload, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(name, JSON.stringify(legacy[name]));
    }
    database.exec("COMMIT");
    migratedFromJson = true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function readCollection<T>(name: CollectionName): T[] {
  const row = getDb().prepare("SELECT payload FROM rf_fip_collections WHERE name = ?").get(name) as { payload: string } | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.payload) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeCollection<T>(name: CollectionName, items: T[]): T[] {
  getDb().prepare(`
    INSERT OR REPLACE INTO rf_fip_collections (name, payload, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(name, JSON.stringify(items));
  return items;
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)];
}

export function getRfFipDbSnapshot(): RfFipDb {
  return {
    issues: readCollection<PersistedIssue>("issues"),
    knowledgeCases: readCollection<PersistedKnowledgeCase>("knowledgeCases"),
    signatureDictionary: readCollection<PersistedSignature>("signatureDictionary"),
    signatureAliasDictionary: readCollection<PersistedSignatureAliasEntry>("signatureAliasDictionary"),
    signatureWeightRules: readCollection<PersistedSignatureWeightRule>("signatureWeightRules"),
    importResults: readCollection<PersistedImportResult>("importResults"),
  };
}

export function getRfFipStorageInfo() {
  getDb();
  return { dbPath: sqlitePath, engine: "sqlite", migratedFromJson };
}

export function saveIssue(item: PersistedIssue): PersistedIssue {
  if (!item?.id || !item?.title) {
    throw new Error("Issue requires id and title");
  }
  writeCollection("issues", upsertById(readCollection<PersistedIssue>("issues"), item));
  return item;
}

export function replaceIssues(items: PersistedIssue[]) {
  return writeCollection("issues", items);
}

export function saveKnowledgeCase(item: PersistedKnowledgeCase): PersistedKnowledgeCase {
  if (!item?.id || !item?.title) {
    throw new Error("Knowledge case requires id and title");
  }
  writeCollection("knowledgeCases", upsertById(readCollection<PersistedKnowledgeCase>("knowledgeCases"), item));
  return item;
}

export function replaceKnowledgeCases(items: PersistedKnowledgeCase[]) {
  return writeCollection("knowledgeCases", items);
}

export function replaceSignatureDictionary(items: PersistedSignature[]) {
  return writeCollection("signatureDictionary", items);
}

export function replaceSignatureAliasDictionary(items: PersistedSignatureAliasEntry[]) {
  return writeCollection("signatureAliasDictionary", items);
}

export function replaceSignatureWeightRules(items: PersistedSignatureWeightRule[]) {
  return writeCollection("signatureWeightRules", items);
}

export function saveImportResult(item: PersistedImportResult): PersistedImportResult {
  if (!item?.id) {
    throw new Error("Import result requires id");
  }
  writeCollection("importResults", upsertById(readCollection<PersistedImportResult>("importResults"), item));
  return item;
}
