import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-signature-hierarchy");
const registryBundlePath = path.join(scratchDir, "signature-concept-registry.mjs");
const weightsBundlePath = path.join(scratchDir, "signature-weights.mjs");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/signatureConceptRegistry.ts", registryBundlePath],
  ["client/src/lib/signatureWeights.ts", weightsBundlePath],
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

const registry = await import(`${pathToFileURL(registryBundlePath).href}?t=${Date.now()}`);
const weights = await import(`${pathToFileURL(weightsBundlePath).href}?t=${Date.now()}`);
const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);

const keyMatch = registry.resolveSignatureConceptKey("Contact Type");
assert(keyMatch?.conceptId === "mechanical.contact_structure", "Key aliases should resolve to a hierarchical concept id.");
assert(keyMatch?.path === "mechanical.contact_structure", "Concept key match should expose a stable concept path.");

const valueMatch = registry.resolveSignatureConcept({ key: "Structure", value: "백글" });
assert(valueMatch?.valueId === "back_glass", "Value aliases should resolve to simplified value ids.");

const rules = weights.mergeSignatureWeightRules();
assert(
  weights.getSignatureGroupWeight("Contact Type", "retrieval", rules) ===
    weights.getSignatureGroupWeight("Contact Structure", "retrieval", rules),
  "Weight lookup should use concept hierarchy for key aliases.",
);

const context = weights.weightedSignatureContext([{ key: "Structure", value: "백글" }], rules);
assert(context[0].conceptId === "mechanical.contact_structure", "Weighted LLM context should include conceptId.");
assert(context[0].valueId === "back_glass", "Weighted LLM context should include simplified valueId.");
assert(context[0].canonicalKey === "Contact Structure", "Weighted LLM context should include canonical display key.");
assert(context[0].canonicalValue === "Back Glass", "Weighted LLM context should include canonical display value.");

const score = similar.calcSimilarity(
  [{ key: "Structure", value: "백글" }],
  {
    id: "KB-HIER",
    title: "Back glass contact",
    model: "TEST",
    band: "B3",
    status: "confirmed",
    confirmedRootCause: "Back glass contact",
    mitigation: "Adjust back glass contact",
    signatures: [{ key: "Contact Type", value: "BackGlass" }],
  },
  rules,
);
assert(score >= 70, "Similarity should match hierarchical key aliases and simplified values.");

console.log("RF-FIP signature hierarchy smoke passed.");
