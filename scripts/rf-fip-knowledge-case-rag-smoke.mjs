import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", `smoke-knowledge-case-rag-${Date.now()}`);
const storeBundlePath = path.join(scratchDir, "rf-fip-store.mjs");
const ragBundlePath = path.join(scratchDir, "rf-fip-rag.mjs");
const llmBundlePath = path.join(scratchDir, "rf-fip-llm-adapter.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
process.env.RF_FIP_DB_DIR = scratchDir;
process.env.LLM_PROVIDER = "local";

for (const [entry, outfile] of [
  ["server/rfFipStore.ts", storeBundlePath],
  ["server/rfFipRag.ts", ragBundlePath],
  ["server/rfFipLlmAdapter.ts", llmBundlePath],
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
store.saveKnowledgeCase({
  id: "KB-CONF-001",
  title: "Confirmed Back Glass pressure desense",
  model: "INTERNAL-MODEL-SHOULD-NOT-APPEAR",
  band: "B3",
  status: "confirmed",
  symptomPattern: "Tx correlated desense improves during Back Glass pressure A/B.",
  confirmedRootCause: "Back Glass contact pressure changed antenna ground path.",
  mitigation: "Restore spring contact preload and verify shielding A/B.",
  diagnosticTests: ["conducted RX baseline", "OTA TIS retest", "pressure A/B"],
  lessonsLearned: "Use confirmed case only as reference; request fresh measured evidence.",
  decisionRationale: ["Conducted RX was normal.", "OTA failed only under assembly pressure change."],
  usedMaterials: [
    {
      id: "M-URL",
      type: "url",
      name: "raw-internal-thread",
      url: "https://internal.example.invalid/raw-thread",
    },
  ],
  signatures: [
    { key: "Contact Structure", value: "Back Glass" },
    { key: "Pressure Sensitivity", value: "True" },
  ],
});

store.saveKnowledgeCase({
  id: "KB-VAL-001",
  title: "Validated only conducted fail",
  model: "INTERNAL-VALIDATED",
  band: "B7",
  status: "validated",
  symptomPattern: "Conducted RX fail after LNA gain step.",
  confirmedRootCause: "LNA gain control path suspect.",
  mitigation: "Retest LNA gain states.",
  diagnosticTests: ["conducted RX baseline"],
  lessonsLearned: "Validated cases are not RAG excerpts.",
  decisionRationale: ["Validated but not confirmed."],
  signatures: [
    { key: "Conducted Result", value: "Fail" },
    { key: "LNA", value: "Check required" },
  ],
});

const rag = await import(`${pathToFileURL(ragBundlePath).href}?t=${Date.now()}`);

const excerpts = rag.loadKnowledgeCaseExcerptDocuments();
assert(excerpts.length === 1, "Only confirmed Knowledge cases should become RAG excerpts.");
assert(excerpts[0].id === "knowledge-case-KB-CONF-001", "Confirmed Knowledge case excerpt id should be stable.");
assert(excerpts[0].sourceCaseId === "KB-CONF-001", "Excerpt should expose sourceCaseId.");
assert(excerpts[0].sourceKind === "knowledge-case-excerpt", "Excerpt should expose sourceKind.");
assert(excerpts[0].sourceStatus === "confirmed", "Excerpt should expose confirmed sourceStatus.");
assert(excerpts[0].securityClass === "internal-only", "Knowledge case excerpts should default to internal-only.");
assert(excerpts[0].allowedProviders.includes("local"), "Knowledge case excerpts should allow local provider.");
assert(excerpts[0].allowedProviders.includes("gauss"), "Knowledge case excerpts should allow gauss provider.");
assert(!excerpts[0].allowedProviders.includes("openai"), "Knowledge case excerpts must not allow OpenAI by default.");
assert(!excerpts[0].body.includes("https://internal.example.invalid"), "Excerpt must not include raw attachment URLs.");
assert(!excerpts[0].body.includes("INTERNAL-MODEL-SHOULD-NOT-APPEAR"), "Excerpt must not include model metadata.");

const localContext = rag.retrieveKnowledgeContext({
  provider: "local",
  task: "chat-reply",
  text: "Back Glass pressure A/B Tx desense with conducted RX normal",
  signatures: [{ key: "Contact Structure", value: "Back Glass" }],
  maxSnippets: 8,
});
const localIds = localContext.snippets.map(item => item.id);
assert(localIds.includes("knowledge-case-KB-CONF-001"), `Local retrieval should include confirmed excerpt, got ${localIds.join(", ")}`);
assert(!localIds.includes("knowledge-case-KB-VAL-001"), "Validated Knowledge case must not be retrieved as RAG.");
assert(localContext.snippets.some(item => item.sourceCaseId === "KB-CONF-001"), "Snippet should include sourceCaseId metadata.");

const gaussContext = rag.retrieveKnowledgeContext({
  provider: "gauss",
  task: "rca-summary",
  text: "Back Glass pressure desense",
  signatures: [{ key: "Pressure Sensitivity", value: "True" }],
  maxSnippets: 8,
});
assert(gaussContext.snippets.some(item => item.id === "knowledge-case-KB-CONF-001"), "Gauss retrieval should be eligible for internal-only excerpts.");

const openAiContext = rag.retrieveKnowledgeContext({
  provider: "openai",
  task: "chat-reply",
  text: "Back Glass pressure desense",
  signatures: [{ key: "Pressure Sensitivity", value: "True" }],
  maxSnippets: 8,
});
assert(openAiContext.snippets.every(item => item.sourceType !== "knowledge-case-excerpt"), "OpenAI must not receive internal Knowledge case excerpts.");
assert(openAiContext.snippets.every(item => item.securityClass === "public-safe"), "OpenAI snippets must remain public-safe.");

const skipped = rag.retrieveKnowledgeContext({
  provider: "local",
  task: "signature-normalize",
  text: "Back Glass pressure desense",
});
assert(skipped.snippets.length === 0, "Knowledge DB RAG should not apply to signature-normalize.");

const llm = await import(`${pathToFileURL(llmBundlePath).href}?t=${Date.now()}`);
const response = await llm.runRfFipLlm({
  task: "chat-reply",
  text: "Back Glass pressure A/B Tx desense with conducted RX normal",
  signatures: [{ key: "Contact Structure", value: "Back Glass" }],
  context: {},
});
assert(response.provider === "local", "Smoke should use local provider.");
assert(Array.isArray(response.result.usedWikiSourceIds), "Local response should keep usedWikiSourceIds.");
assert(Array.isArray(response.result.usedKnowledgeCaseSourceIds), "Local response should expose usedKnowledgeCaseSourceIds.");
assert(response.result.usedKnowledgeCaseSourceIds.includes("knowledge-case-KB-CONF-001"), "Local response should cite confirmed Knowledge case excerpt id.");

console.log("RF-FIP Knowledge case RAG smoke passed.");
