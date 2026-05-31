import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "server", "rfFipLlmAdapter.ts"), "utf8");

const requiredNeedles = [
  "rfKnowledgeContext",
  "retrievedKnowledgeContext",
  "usedWikiSourceIds",
  "usedKnowledgeCaseSourceIds",
  "existingSignatureGuard",
  "Return only signatures",
  "Knowledge case excerpts are confirmed-case references only",
  "context.sharedAnalysisContext.signatures",
  "Do not invent measurements",
  "enforceSignatureDedupe",
  "filterNewSignatures",
];

const missing = requiredNeedles.filter(needle => !source.includes(needle));
if (missing.length) {
  throw new Error(`LLM prompt contract smoke failed. Missing: ${missing.join(", ")}`);
}

console.log("LLM prompt contract smoke passed");
