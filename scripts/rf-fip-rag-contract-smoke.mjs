import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-rag-contract");
const ragBundlePath = path.join(scratchDir, "rf-fip-rag.mjs");
const llmBundlePath = path.join(scratchDir, "rf-fip-llm-adapter.mjs");
const adapterPath = path.join(projectRoot, "server", "rfFipLlmAdapter.ts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
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

const rag = await import(`${pathToFileURL(ragBundlePath).href}?t=${Date.now()}`);
const adapterSource = await fs.readFile(adapterPath, "utf8");

const docs = rag.loadLocalPublicWikiDocuments();
assert(docs.length >= 5, "Local public RF wiki should include seed documents.");
assert(docs.every(doc => doc.securityClass === "public-safe"), "Local public wiki docs must be public-safe.");
assert(docs.every(doc => doc.allowedProviders.includes("openai")), "Local public wiki docs should be OpenAI-eligible.");

const context = rag.retrieveKnowledgeContext({
  provider: "openai",
  task: "chat-reply",
  text: "B3 Tx desense with BackGlass shield contact and pressure A/B needed",
  context: {
    localEvidencePacket: {
      classification: "TX-induced PIM Desense",
      mergedSignatures: [
        { key: "Tx Correlated", value: "True" },
        { key: "Contact Structure", value: "Back Glass" },
      ],
      conceptRelationHints: [
        { sourceConceptId: "mechanical.contact_structure", targetConceptId: "mechanical.pressure_sensitive" },
      ],
    },
  },
  signatures: [{ key: "Contact Structure", value: "Back Glass" }],
});

assert(context.policy.referenceOnly === true, "RAG context must be reference-only.");
assert(context.snippets.length > 0, "OpenAI chat RAG should retrieve at least one public snippet.");
assert(context.snippets.every(item => item.securityClass === "public-safe"), "OpenAI RAG snippets must be public-safe.");
assert(context.snippets.some(item => item.id === "wiki-tx-induced-pim" || item.id === "wiki-mechanical-pressure-ab"), "RF/PIM/contact query should retrieve relevant wiki snippets.");
assert(context.blockedReasons.some(item => item.includes("GAUSS_WIKI_API_URL")), "Gauss internal wiki contract should report blocked missing URL.");

const skipped = rag.retrieveKnowledgeContext({
  provider: "openai",
  task: "import-classify",
  text: "B3 Tx desense",
});
assert(skipped.snippets.length === 0, "RAG should not apply to import-classify in the first implementation.");

assert(adapterSource.includes("retrievedKnowledgeContext"), "LLM adapter should pass retrievedKnowledgeContext.");
assert(adapterSource.includes("usedWikiSourceIds"), "LLM adapter should request wiki source ids from providers.");

process.env.LLM_PROVIDER = "local";
const llm = await import(`${pathToFileURL(llmBundlePath).href}?t=${Date.now()}`);
const response = await llm.runRfFipLlm({
  task: "chat-reply",
  text: "B3 Tx desense with BackGlass shield contact and pressure A/B needed",
  signatures: [{ key: "Contact Structure", value: "Back Glass" }],
  context: {},
});
assert(response.provider === "local", "Local provider should be used in smoke.");
assert(Array.isArray(response.result.usedWikiSourceIds), "Local provider should expose used wiki source ids.");
assert(response.result.usedWikiSourceIds.length > 0, "Local provider should receive retrieved wiki context for chat replies.");

console.log("RF-FIP RAG contract smoke passed.");
