import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-hybrid-hypothesis");
const bundlePath = path.join(scratchDir, "hybrid-hypothesis.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "hybridHypothesis.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const {
  buildLocalHybridHypotheses,
  validateHybridHypothesisCandidate,
} = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const packet = {
  version: 1,
  inputSummary: "B3 desense with shield clip PIM",
  extractedTags: [{ key: "Band", value: "B3" }],
  mergedSignatures: [{ key: "Band", value: "B3" }],
  classification: "TX-induced PIM Desense",
  mechanism: "Contact nonlinearity creates IM product into Rx band",
  rationale: ["Tx correlated", "PIM signature present"],
  diagnosticTests: ["Tx power sweep", "Pressure A/B test"],
  missingInfo: ["Conducted RX baseline"],
  similarCases: [{ id: "KB-2023-012", title: "B3 PIM", similarity: 82 }],
  evidence: [
    { id: "classification", type: "classification", label: "TX-induced PIM Desense", detail: "mechanism", source: "taxonomy", weight: "high" },
    { id: "rationale-1", type: "rationale", label: "분류 판단 근거", detail: "Tx correlated", source: "taxonomy", weight: "high" },
    { id: "test-1", type: "diagnostic_test", label: "권장 판별 시험", detail: "Tx power sweep", source: "taxonomy", weight: "medium" },
    { id: "missing-1", type: "missing_info", label: "부족 정보", detail: "Conducted RX baseline", source: "local-rule", weight: "medium" },
  ],
};

const hypotheses = buildLocalHybridHypotheses(packet);
assert(hypotheses.length === 1, "Expected one local hybrid hypothesis.");
assert(hypotheses[0].title === packet.classification, "Hypothesis title should match packet classification.");
assert(hypotheses[0].evidence.length > 0, "Hypothesis evidence should be mapped.");
assert(hypotheses[0].nextActions.includes("Tx power sweep"), "Hypothesis next actions should come from packet diagnostic tests.");

const errors = validateHybridHypothesisCandidate({
  id: "bad",
  title: "Bad",
  confidence: 50,
  supportingEvidenceIds: ["unknown-id"],
  rejectedEvidenceIds: [],
  mechanism: "bad",
  nextActions: [],
  missingInfo: [],
  source: "llm",
}, packet);
assert(errors.some(error => error.includes("unknown evidence id")), "Unknown evidence id should fail validation.");

console.log("RF-FIP hybrid hypothesis smoke passed.");
