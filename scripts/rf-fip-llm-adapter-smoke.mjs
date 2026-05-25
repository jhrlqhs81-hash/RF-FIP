import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-llm-adapter");
const bundlePath = path.join(scratchDir, "rf-fip-llm-adapter.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "server", "rfFipLlmAdapter.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { runRfFipLlm, GaussBlockedError } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

process.env.LLM_PROVIDER = "local";
delete process.env.GAUSS_API_URL;
delete process.env.GAUSS_API_KEY;

const payload = {
  task: "chat-reply",
  text: "B3 RX sensitivity drops 4dB during Tx 23dBm with shield clip PIM IM3.",
  signatures: [],
};
const first = await runRfFipLlm(payload);
const second = await runRfFipLlm(payload);

assert(first.provider === "local", "Local LLM response provider mismatch.");
assert(first.task === "chat-reply", "Local LLM task mismatch.");
assert(first.result?.content === second.result?.content, "Local LLM response is not deterministic.");
assert(JSON.stringify(first.result?.extractedTags) === JSON.stringify(second.result?.extractedTags), "Local extracted tags are not deterministic.");

process.env.LLM_PROVIDER = "gauss";
let blockedError;
try {
  await runRfFipLlm({ task: "chat-reply", text: "B3 PIM desense", signatures: [] });
} catch (error) {
  blockedError = error;
}

assert(blockedError instanceof GaussBlockedError, "Gauss provider did not throw GaussBlockedError.");
assert(blockedError.status === 501, "Gauss blocked error status mismatch.");
assert(blockedError.missing.includes("GAUSS_API_URL"), "Gauss blocked error did not include missing GAUSS_API_URL.");
assert(blockedError.missing.includes("GAUSS_API_KEY"), "Gauss blocked error did not include missing GAUSS_API_KEY.");

process.env.GAUSS_API_URL = "https://gauss.invalid/internal";
process.env.GAUSS_API_KEY = "SHOULD_NOT_LEAK_SECRET";
let secretBlockedError;
try {
  await runRfFipLlm({ task: "chat-reply", text: "B7 display MIPI spur desense", signatures: [] });
} catch (error) {
  secretBlockedError = error;
}

assert(secretBlockedError instanceof GaussBlockedError, "Gauss provider with env did not remain blocked.");
assert(secretBlockedError.status === 501, "Gauss blocked-with-env status mismatch.");
assert(!JSON.stringify(secretBlockedError).includes("SHOULD_NOT_LEAK_SECRET"), "Gauss blocked error leaked API key.");

console.log("RF-FIP LLM adapter smoke passed: local deterministic response and gauss blocked contract.");
