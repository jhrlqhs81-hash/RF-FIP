import { build } from "esbuild";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-openai-live");
const bundlePath = path.join(scratchDir, "rf-fip-llm-adapter.mjs");

function loadDotEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

loadDotEnv();
process.env.LLM_PROVIDER = "openai";
assert(
  process.env.OPENAI_API_KEY || process.env["open-ai-api-key"],
  "OPENAI_API_KEY is required in .env or the process environment."
);

await fsPromises.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "server", "rfFipLlmAdapter.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { runRfFipLlm, LlmProviderError } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

try {
  const response = await runRfFipLlm({
    task: "chat-reply",
    text: "B3 RX sensitivity drops 4dB during Tx 23dBm with shield clip PIM IM3.",
    signatures: [],
  });

  assert(response.provider === "openai", "OpenAI provider response mismatch.");
  assert(response.task === "chat-reply", "OpenAI task response mismatch.");
  assert(response.result && typeof response.result === "object", "OpenAI result is missing.");

  console.log(JSON.stringify({
    provider: response.provider,
    task: response.task,
    resultKeys: Object.keys(response.result),
    hasContent: typeof response.result.content === "string" && response.result.content.length > 0,
  }));
} catch (error) {
  if (error instanceof LlmProviderError) {
    console.error(JSON.stringify({
      provider: error.provider,
      status: error.status,
      blocked: error.blocked === true,
      missing: error.missing ?? [],
      message: error.message,
    }));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
