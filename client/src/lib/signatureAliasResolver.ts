import type { SignatureTag } from "./mockData";

export interface SignatureAliasEntry {
  id?: string;
  canonicalKey: string;
  canonicalValue: string;
  aliases: string[];
  domain: "rf" | "mechanical" | "test" | "source";
  status?: "approved" | "pending";
  confidence?: number;
  source?: "builtin" | "user-approved" | "imported";
}

export interface SignatureAliasCandidate {
  raw: string;
  canonicalKey: string;
  canonicalValue: string;
  score: number;
  matchedAlias: string;
}

export const SIGNATURE_ALIAS_DICTIONARY: SignatureAliasEntry[] = [
  {
    canonicalKey: "Contact Structure",
    canonicalValue: "Back Glass",
    aliases: ["backglass", "back glass", "back-glass", "rear glass", "rear cover glass", "백글라스", "백글", "후면 글라스"],
    domain: "mechanical",
  },
  {
    canonicalKey: "Contact Structure",
    canonicalValue: "Shield Can",
    aliases: ["shield can", "shield-can", "shieldcan", "쉴드캔", "쉴드 캔", "차폐캔", "차폐 캔"],
    domain: "mechanical",
  },
  {
    canonicalKey: "Pressure Sensitive",
    canonicalValue: "True",
    aliases: ["contact force", "press", "pressure", "가압", "압력", "접촉압", "누름"],
    domain: "test",
  },
  {
    canonicalKey: "Reassembly Effect",
    canonicalValue: "Disappears",
    aliases: ["reassembly", "re-assembly", "re assemble", "재조립", "재 조립", "분해조립"],
    domain: "test",
  },
  {
    canonicalKey: "Desense Type",
    canonicalValue: "Sensitivity Drop",
    aliases: ["desense", "sensitivity drop", "sensitivity loss", "rx sensitivity drop", "감도저하", "감도 저하", "수신감도", "수신 감도"],
    domain: "rf",
  },
  {
    canonicalKey: "Conducted Result",
    canonicalValue: "Check required",
    aliases: ["conducted", "conducted rx", "rf cable", "cable rx", "전도", "전도시험", "케이블"],
    domain: "test",
  },
  {
    canonicalKey: "OTA Result",
    canonicalValue: "Check required",
    aliases: ["ota", "tis", "eis", "chamber", "radiated", "방사", "챔버"],
    domain: "test",
  },
];

export function getApprovedAliasDictionary(entries: SignatureAliasEntry[] = SIGNATURE_ALIAS_DICTIONARY): SignatureAliasEntry[] {
  return entries.filter(entry => (entry.status ?? "approved") === "approved");
}

export function normalizeAliasToken(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_./()[\]{}]+/g, "")
    .trim();
}

function aliasTokens(entry: SignatureAliasEntry): string[] {
  return [entry.canonicalValue, ...entry.aliases].map(normalizeAliasToken).filter(Boolean);
}

export function resolveAliasesInText(text: string): SignatureTag[] {
  const normalizedText = normalizeAliasToken(text);
  const resolved: SignatureTag[] = [];

  for (const entry of getApprovedAliasDictionary()) {
    if (aliasTokens(entry).some(alias => alias.length >= 2 && normalizedText.includes(alias))) {
      resolved.push({ key: entry.canonicalKey, value: entry.canonicalValue, isNew: true });
    }
  }

  return canonicalizeSignatures(resolved);
}

export function canonicalizeSignatureTag(tag: SignatureTag): SignatureTag {
  const normalizedKey = normalizeAliasToken(tag.key);
  const normalizedValue = normalizeAliasToken(tag.value);

  for (const entry of getApprovedAliasDictionary()) {
    const keyMatches =
      normalizeAliasToken(entry.canonicalKey) === normalizedKey ||
      normalizeSignatureKeyComparable(entry.canonicalKey) === normalizeSignatureKeyComparable(tag.key);
    if (!keyMatches) continue;
    if (aliasTokens(entry).includes(normalizedValue)) {
      return { ...tag, key: entry.canonicalKey, value: entry.canonicalValue };
    }
  }

  for (const entry of getApprovedAliasDictionary()) {
    if (aliasTokens(entry).includes(normalizedValue)) {
      return { ...tag, key: entry.canonicalKey, value: entry.canonicalValue };
    }
  }

  return tag;
}

export function canonicalizeSignatures(tags: SignatureTag[]): SignatureTag[] {
  const merged: SignatureTag[] = [];
  for (const input of tags) {
    const tag = canonicalizeSignatureTag(input);
    const exists = merged.some(item =>
      normalizeAliasToken(item.key) === normalizeAliasToken(tag.key) &&
      normalizeAliasToken(item.value) === normalizeAliasToken(tag.value)
    );
    if (!exists) merged.push(tag);
  }
  return merged;
}

export function normalizeSignatureComparable(value: string): string {
  const normalized = normalizeAliasToken(value);
  for (const entry of getApprovedAliasDictionary()) {
    if (aliasTokens(entry).includes(normalized)) return normalizeAliasToken(entry.canonicalValue);
  }
  return normalized;
}

export function normalizeSignatureKeyComparable(key: string): string {
  const normalized = normalizeAliasToken(key);
  if (["structure", "contactstructure", "contacttype", "suspectedstructure", "mechanicalstructure"].includes(normalized)) {
    return "Contact Structure";
  }
  return key.trim();
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

export function findPendingAliasCandidates(text: string, threshold = 0.72): SignatureAliasCandidate[] {
  const exactValues = new Set(resolveAliasesInText(text).map(tag => `${tag.key}:${tag.value}`));
  const candidates: SignatureAliasCandidate[] = [];

  for (const raw of inputTerms(text)) {
    for (const entry of getApprovedAliasDictionary()) {
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
