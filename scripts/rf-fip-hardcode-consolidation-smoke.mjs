import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-hardcode-consolidation");
const sharedBundlePath = path.join(scratchDir, "rf-fip-rule-catalog.mjs");
const localBundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");
const serverBundlePath = path.join(scratchDir, "rf-fip-llm-adapter.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["shared/rfFipRuleCatalog.ts", sharedBundlePath],
  ["client/src/lib/localRfAnalyzer.ts", localBundlePath],
  ["server/rfFipLlmAdapter.ts", serverBundlePath],
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

const shared = await import(`${pathToFileURL(sharedBundlePath).href}?t=${Date.now()}`);
const local = await import(`${pathToFileURL(localBundlePath).href}?t=${Date.now()}`);
process.env.LLM_PROVIDER = "local";
const server = await import(`${pathToFileURL(serverBundlePath).href}?t=${Date.now()}`);

assert(!shared.hasRfAnalysisIntent("당신은 누구입니까", 0), "General chat should not be classified as RF intent.");
assert(shared.hasRfAnalysisIntent("B3 Tx 22dBm OTA sensitivity drop", 0), "RF text should be classified as RF intent.");

const sharedTags = shared.extractCoreRfSignatures("B3 Tx 22dBm OTA sensitivity drop PMIC noise");
assert(sharedTags.some(tag => tag.key === "Band" && tag.value === "B3"), "Shared rules should extract Band.");
assert(sharedTags.some(tag => tag.key === "Tx Power" && tag.value === "22dBm"), "Shared rules should extract Tx Power.");
assert(sharedTags.some(tag => tag.key === "Noise Source" && tag.value === "PMIC/DCDC"), "Shared rules should extract PMIC/DCDC noise source.");

const localTags = local.extractRfSignatures("B3 Tx 22dBm OTA sensitivity drop PMIC noise");
assert(localTags.some(tag => tag.key === "Tx Power" && tag.value === "22dBm"), "Client local analyzer should use shared RF extraction.");
assert(localTags.some(tag => tag.key === "Noise Source" && tag.value === "PMIC/DCDC"), "Client local analyzer should keep shared internal-noise extraction.");

const response = await server.runRfFipLlm({
  task: "chat-reply",
  text: "B3 Tx 22dBm OTA sensitivity drop PMIC noise",
  signatures: [],
  context: {},
});
assert(response.provider === "local", "Server local fallback should be active in this smoke.");
assert(response.result?.extractedTags?.some?.(tag => tag.key === "Tx Power" && tag.value === "22dBm"), "Server local fallback should use shared RF extraction.");
assert(response.result?.classification === "Internal Desense / Spurious", "Server local fallback should use shared RF classification.");

console.log("RF-FIP hardcode consolidation smoke passed.");
