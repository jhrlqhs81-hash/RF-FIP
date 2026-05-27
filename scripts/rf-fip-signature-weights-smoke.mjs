import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-signature-weights");
const weightsBundlePath = path.join(scratchDir, "signature-weights.mjs");
const localBundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/signatureWeights.ts", weightsBundlePath],
  ["client/src/lib/localRfAnalyzer.ts", localBundlePath],
  ["client/src/lib/similarCasesDb.ts", similarBundlePath],
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

const weights = await import(`${pathToFileURL(weightsBundlePath).href}?t=${Date.now()}`);
const local = await import(`${pathToFileURL(localBundlePath).href}?t=${Date.now()}`);
const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);

const rules = weights.mergeSignatureWeightRules([
  {
    id: "custom-band",
    signatureKey: "Band",
    analysisWeight: 0,
    retrievalWeight: 0,
    workflowWeight: 0,
    enabled: true,
    reason: "test",
    operationRule: "test",
    updatedAt: new Date().toISOString(),
  },
]);
assert(weights.getSignatureGroupWeight("Tx Correlated", "analysis", rules) === 5, "Default Tx Correlated analysis weight should be 5.");
assert(weights.getSignatureGroupWeight("Band", "retrieval", rules) === 0, "Persisted rules should override defaults.");

const packet = local.buildLocalEvidencePacket({
  text: "B3 Tx high power desense PIM suspected",
  existingSignatures: [{ key: "Band", value: "B3" }],
  signatureWeightRules: rules,
});
assert(packet.missingInfo[0] === "Tx power sweep result", "Workflow weights should order missing checklist items.");
assert(packet.evidence.some(item => item.type === "missing_info"), "Missing checklist should be represented as evidence.");

const baseScore = similar.calcSimilarity(
  [{ key: "Band", value: "B3" }],
  {
    id: "KB-WEIGHT",
    title: "B3 case",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "test",
    mitigation: "test",
    signatures: [{ key: "Band", value: "B3" }],
  },
);
const disabledScore = similar.calcSimilarity(
  [{ key: "Band", value: "B3" }],
  {
    id: "KB-WEIGHT",
    title: "B3 case",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "test",
    mitigation: "test",
    signatures: [{ key: "Band", value: "B3" }],
  },
  rules,
);
assert(baseScore > disabledScore, "Retrieval weight override should affect similarity score.");

console.log("RF-FIP signature weights smoke passed.");
