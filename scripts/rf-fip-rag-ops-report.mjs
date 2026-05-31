import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-rag-ops-report");
const opsBundlePath = path.join(scratchDir, "rf-fip-rag-ops.mjs");

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const failOnWarn = args.has("--fail-on-warn");

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "server", "rfFipRagOps.ts")],
  outfile: opsBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const ops = await import(`${pathToFileURL(opsBundlePath).href}?t=${Date.now()}`);
const report = ops.buildRagOpsReport({ failOnWarn });

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`RF-FIP RAG ops report: ${report.verdict}`);
  console.log(`- public RF Wiki docs: ${report.counts.publicWikiDocuments}`);
  console.log(`- Knowledge case excerpts: ${report.counts.knowledgeCaseExcerpts}`);
  console.log(`- OpenAI probe snippets: ${report.counts.openAiProbeSnippets}`);
  for (const item of report.warnings) console.log(`WARN: ${item}`);
  for (const item of report.errors) console.log(`FAIL: ${item}`);
}

if (report.verdict === "FAIL") process.exit(1);
