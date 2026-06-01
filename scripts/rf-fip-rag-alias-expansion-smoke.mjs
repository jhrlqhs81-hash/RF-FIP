import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-rag-alias-expansion");
const ragBundlePath = path.join(scratchDir, "rf-fip-rag.mjs");
const storeBundlePath = path.join(scratchDir, "rf-fip-store.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.rm(scratchDir, { recursive: true, force: true });
await fs.mkdir(scratchDir, { recursive: true });
process.env.RF_FIP_DB_DIR = scratchDir;

for (const [entry, outfile] of [
  ["server/rfFipRag.ts", ragBundlePath],
  ["server/rfFipStore.ts", storeBundlePath],
]) {
  await build({
    entryPoints: [path.join(projectRoot, entry)],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
}

const store = await import(`${pathToFileURL(storeBundlePath).href}?t=${Date.now()}`);
const rag = await import(`${pathToFileURL(ragBundlePath).href}?t=${Date.now()}`);

store.replaceSignatureAliasDictionary([
  {
    id: "rag-related-display-toggle",
    canonicalKey: "Diagnostic Gate",
    canonicalValue: "Function ON/OFF A/B",
    aliases: ["displaytoggle"],
    domain: "workflow",
    status: "approved",
    confidence: 0.88,
    source: "imported",
    aliasType: "semantic_alias",
    relationType: "related_to",
    note: "Use as query expansion only; do not canonicalize as a signature.",
  },
]);

const withoutExpansion = rag.retrieveKnowledgeContext({
  provider: "openai",
  task: "chat-reply",
  text: "displaytoggle issue",
  maxSnippets: 4,
});

assert(withoutExpansion.expandedQueryTerms?.includes("diagnosticgate"), "RAG should expose deterministic alias-expanded query terms.");
assert(withoutExpansion.expandedQueryTerms?.includes("functiononoffab"), "Related alias should expand toward canonical value for retrieval only.");
assert(
  withoutExpansion.snippets.some(item => item.id === "wiki-internal-spur-function-on-off"),
  "Related alias query expansion should retrieve Function ON/OFF RF wiki guidance.",
);
assert(
  withoutExpansion.snippets.every(item => item.securityClass === "public-safe"),
  "OpenAI RAG alias expansion must preserve provider/security filtering.",
);

store.replaceSignatureAliasDictionary([
  {
    id: "rag-rejected-display-toggle",
    canonicalKey: "Diagnostic Gate",
    canonicalValue: "Function ON/OFF A/B",
    aliases: ["rejecttoggle"],
    domain: "workflow",
    status: "approved",
    confidence: 0.99,
    source: "imported",
    relationType: "reject",
  },
]);

const rejected = rag.retrieveKnowledgeContext({
  provider: "openai",
  task: "chat-reply",
  text: "rejecttoggle issue",
  maxSnippets: 4,
});
assert(!(rejected.expandedQueryTerms ?? []).includes("diagnosticgate"), "Rejected alias relation must not expand query terms.");

console.log("RF-FIP RAG alias expansion smoke passed.");
