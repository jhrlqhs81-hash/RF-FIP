import type { SignatureTag } from "./mockData";
import {
  canonicalizeSignatureByConcept,
  conceptAliasEntries,
  normalizeConceptKey,
  normalizeConceptToken,
  signatureConceptComparable,
  type SignatureConceptDomain,
} from "./signatureConceptRegistry";

export interface SignatureAliasEntry {
  id?: string;
  canonicalKey: string;
  canonicalValue: string;
  aliases: string[];
  domain: SignatureConceptDomain;
  status?: "approved" | "pending";
  confidence?: number;
  source?: "builtin" | "user-approved" | "imported";
  conceptId?: string;
  valueId?: string;
  aliasType?: SignatureAliasType;
  relationType?: SignatureAliasRelationType;
  sourceDocId?: string;
  approvedBy?: string;
  note?: string;
  scope?: string;
}

export interface SignatureAliasCandidate {
  raw: string;
  canonicalKey: string;
  canonicalValue: string;
  score: number;
  matchedAlias: string;
  suggestedRelation?: SignatureAliasRelationType;
}

export type SignatureAliasType =
  | "synonym"
  | "abbreviation"
  | "translation"
  | "spelling_variant"
  | "semantic_alias";

export type SignatureAliasRelationType =
  | "synonym"
  | "alias"
  | "abbreviation"
  | "translation"
  | "spelling_variant"
  | "semantic_alias"
  | "related_to"
  | "parent_of"
  | "child_of"
  | "caused_by"
  | "measured_by"
  | "condition_of"
  | "reject";

export const SIGNATURE_ALIAS_DICTIONARY: SignatureAliasEntry[] = conceptAliasEntries();

export function getApprovedAliasDictionary(entries: SignatureAliasEntry[] = SIGNATURE_ALIAS_DICTIONARY): SignatureAliasEntry[] {
  return entries.filter(entry => (entry.status ?? "approved") === "approved");
}

const CANONICALIZING_RELATIONS = new Set<SignatureAliasRelationType>([
  "synonym",
  "alias",
  "abbreviation",
  "translation",
  "spelling_variant",
  "semantic_alias",
]);

export function canAutoCanonicalizeAlias(entry: SignatureAliasEntry): boolean {
  if ((entry.status ?? "approved") !== "approved") return false;
  const relationType = entry.relationType ?? "alias";
  if (!CANONICALIZING_RELATIONS.has(relationType)) return false;
  if (relationType === "semantic_alias" && (entry.confidence ?? 1) < 0.75) return false;
  return true;
}

export function getCanonicalizingAliasDictionary(entries: SignatureAliasEntry[] = SIGNATURE_ALIAS_DICTIONARY): SignatureAliasEntry[] {
  return getApprovedAliasDictionary(entries).filter(canAutoCanonicalizeAlias);
}

export function getRelatedAliasDictionary(entries: SignatureAliasEntry[] = SIGNATURE_ALIAS_DICTIONARY): SignatureAliasEntry[] {
  return entries.filter(entry => !canAutoCanonicalizeAlias(entry) && (entry.relationType ?? "alias") !== "reject");
}

export function mergeSignatureAliasDictionaries(
  overlay: SignatureAliasEntry[] = [],
  builtin: SignatureAliasEntry[] = SIGNATURE_ALIAS_DICTIONARY,
): SignatureAliasEntry[] {
  const byIdentity = new Map<string, SignatureAliasEntry>();
  for (const entry of [...builtin, ...overlay]) {
    const aliases = Array.from(new Set((entry.aliases ?? []).map(alias => alias.trim()).filter(Boolean)));
    const key = [
      normalizeAliasToken(entry.canonicalKey),
      normalizeAliasToken(entry.canonicalValue),
      entry.status ?? "approved",
      entry.source ?? "builtin",
      entry.relationType ?? "alias",
    ].join(":");
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? { ...existing, aliases: Array.from(new Set([...existing.aliases, ...aliases])) } : { ...entry, aliases });
  }
  return Array.from(byIdentity.values());
}

export function normalizeAliasToken(value: string): string {
  return normalizeConceptToken(value);
}

function aliasTokens(entry: SignatureAliasEntry): string[] {
  return [entry.canonicalValue, ...entry.aliases].map(normalizeAliasToken).filter(Boolean);
}

function valueOnlyAliasAllowed(entry: SignatureAliasEntry): boolean {
  const genericValues = new Set(["true", "false", "normal", "fail", "checkrequired", "measuredvdbm", "cacombo"]);
  return !genericValues.has(normalizeAliasToken(entry.canonicalValue));
}

export function resolveAliasesInText(text: string, entries?: SignatureAliasEntry[]): SignatureTag[] {
  const normalizedText = normalizeAliasToken(text);
  const resolved: SignatureTag[] = [];

  for (const entry of getCanonicalizingAliasDictionary(entries ? mergeSignatureAliasDictionaries(entries) : SIGNATURE_ALIAS_DICTIONARY)) {
    if (aliasTokens(entry).some(alias => alias.length >= 2 && normalizedText.includes(alias))) {
      resolved.push({ key: entry.canonicalKey, value: entry.canonicalValue, isNew: true });
    }
  }

  return canonicalizeSignatures(resolved, entries);
}

export function canonicalizeSignatureTag(tag: SignatureTag, entries?: SignatureAliasEntry[]): SignatureTag {
  const conceptTag = canonicalizeSignatureByConcept(tag);
  if (conceptTag.key !== tag.key || conceptTag.value !== tag.value) return conceptTag;

  const normalizedKey = normalizeAliasToken(tag.key);
  const normalizedValue = normalizeAliasToken(tag.value);
  const dictionary = getCanonicalizingAliasDictionary(entries ? mergeSignatureAliasDictionaries(entries) : SIGNATURE_ALIAS_DICTIONARY);

  for (const entry of dictionary) {
    const keyMatches =
      normalizeAliasToken(entry.canonicalKey) === normalizedKey ||
      normalizeSignatureKeyComparable(entry.canonicalKey) === normalizeSignatureKeyComparable(tag.key);
    if (!keyMatches) continue;
    if (aliasTokens(entry).includes(normalizedValue)) {
      return { ...tag, key: entry.canonicalKey, value: entry.canonicalValue };
    }
  }

  for (const entry of dictionary) {
    if (!valueOnlyAliasAllowed(entry)) continue;
    if (aliasTokens(entry).includes(normalizedValue)) {
      return { ...tag, key: entry.canonicalKey, value: entry.canonicalValue };
    }
  }

  return tag;
}

export function canonicalizeSignatures(tags: SignatureTag[], entries?: SignatureAliasEntry[]): SignatureTag[] {
  const merged: SignatureTag[] = [];
  for (const input of tags) {
    const tag = canonicalizeSignatureTag(input, entries);
    const exists = merged.some(item =>
      normalizeAliasToken(item.key) === normalizeAliasToken(tag.key) &&
      normalizeAliasToken(item.value) === normalizeAliasToken(tag.value)
    );
    if (!exists) merged.push(tag);
  }
  return merged;
}

export function normalizeSignatureComparable(value: string, entries?: SignatureAliasEntry[]): string {
  const normalized = normalizeAliasToken(value);
  for (const entry of getCanonicalizingAliasDictionary(entries ? mergeSignatureAliasDictionaries(entries) : SIGNATURE_ALIAS_DICTIONARY)) {
    if (aliasTokens(entry).includes(normalized)) return normalizeAliasToken(entry.canonicalValue);
  }
  return normalized;
}

export function normalizeSignatureKeyComparable(key: string): string {
  return normalizeConceptKey(key);
}

export function normalizeSignatureIdentityComparable(tag: SignatureTag, entries?: SignatureAliasEntry[]): { key: string; value: string } {
  return signatureConceptComparable(canonicalizeSignatureTag(tag, entries));
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 0 : 1 - levenshteinDistance(a, b) / maxLength;
}

function inputTerms(text: string): string[] {
  const normalized = text.normalize("NFKC").toLowerCase();
  const terms = normalized.split(/[^a-z0-9가-힣]+/i);
  const compact = normalizeAliasToken(text);
  return Array.from(new Set([...terms, compact].map(normalizeAliasToken).filter(term => term.length >= 2)));
}

export function findPendingAliasCandidates(text: string, threshold = 0.72, entries?: SignatureAliasEntry[]): SignatureAliasCandidate[] {
  const mergedDictionary = entries ? mergeSignatureAliasDictionaries(entries) : SIGNATURE_ALIAS_DICTIONARY;
  const dictionary = getCanonicalizingAliasDictionary(mergedDictionary);
  const suppressedCandidateTokens = new Set(
    getApprovedAliasDictionary(mergedDictionary)
      .filter(entry => !canAutoCanonicalizeAlias(entry))
      .flatMap(entry => entry.aliases.map(normalizeAliasToken))
      .filter(Boolean)
  );
  const exactValues = new Set(resolveAliasesInText(text, entries).map(tag => `${tag.key}:${tag.value}`));
  const candidates: SignatureAliasCandidate[] = [];

  for (const raw of inputTerms(text)) {
    if (suppressedCandidateTokens.has(raw)) continue;
    for (const entry of dictionary) {
      if (exactValues.has(`${entry.canonicalKey}:${entry.canonicalValue}`)) continue;
      for (const alias of aliasTokens(entry)) {
        const score = similarity(raw, alias);
        if (score >= threshold && score < 1) {
          candidates.push({
            raw,
            canonicalKey: entry.canonicalKey,
            canonicalValue: entry.canonicalValue,
            score: Number(score.toFixed(2)),
            matchedAlias: alias,
            suggestedRelation: entry.relationType ?? "alias",
          });
        }
      }
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, all) =>
      all.findIndex(item => item.raw === candidate.raw && item.canonicalKey === candidate.canonicalKey && item.canonicalValue === candidate.canonicalValue) === index
    )
    .slice(0, 8);
}
