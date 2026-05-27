import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-hybrid-summary");
const bundlePath = path.join(scratchDir, "hybrid-summary.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "hybridSummary.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { buildLocalHybridSummary, validateGroundedSummary } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const packet = {
  version: 1,
  inputSummary: "B3 desense with shield can",
  extractedTags: [{ key: "Band", value: "B3" }],
  mergedSignatures: [{ key: "Band", value: "B3" }, { key: "Contact Type", value: "Shield Can" }],
  classification: "TX-induced PIM Desense",
  mechanism: "Contact nonlinearity creates IM product into Rx band",
  rationale: ["Tx correlated"],
  diagnosticTests: ["Tx power sweep", "Pressure A/B test"],
  missingInfo: ["Conducted RX baseline"],
  similarCases: [],
  evidence: [
    { id: "classification", type: "classification", label: "TX-induced PIM Desense", detail: "mechanism", source: "taxonomy", weight: "high" },
    { id: "rationale-1", type: "rationale", label: "classification reason", detail: "Tx correlated", source: "taxonomy", weight: "high" },
    { id: "test-1", type: "diagnostic_test", label: "test", detail: "Tx power sweep", source: "taxonomy", weight: "medium" },
    { id: "missing-1", type: "missing_info", label: "missing", detail: "Conducted RX baseline", source: "local-rule", weight: "medium" },
  ],
};

const summary = buildLocalHybridSummary({
  packet,
  messageId: "m-user-1",
  timestamp: "10:00",
});

assert(summary.source === "local-rule", "Summary source should be local-rule.");
assert(summary.nextSteps.length > 0, "Summary next steps are missing.");
for (const step of summary.nextSteps) {
  assert(typeof step === "object", "Next step must be structured.");
  assert(step.text && step.rationale && step.messageId, "Next step must include text, rationale, and messageId.");
  assert(Array.isArray(step.evidence) && step.evidence.length > 0, "Next step evidence is required.");
}
assert(validateGroundedSummary(summary).length === 0, "Grounded summary validation failed.");

console.log("RF-FIP hybrid summary smoke passed.");
