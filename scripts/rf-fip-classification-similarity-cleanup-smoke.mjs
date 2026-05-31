import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-classification-similarity-cleanup");
const taxonomyBundlePath = path.join(scratchDir, "rf-desense-taxonomy.mjs");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/rfDesenseTaxonomy.ts", taxonomyBundlePath],
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

const taxonomy = await import(`${pathToFileURL(taxonomyBundlePath).href}?t=${Date.now()}`);
const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);

const internal = taxonomy.classifyDesenseCase(
  [{ key: "Noise Source", value: "PMIC/DCDC" }],
  "n41 PMIC DCDC broadband noise during thermal load",
);
assert(internal.category === "Internal Desense / Spurious", `Expected internal desense category; got ${internal.category}.`);
assert(internal.diagnosticTests.some(test => /Function ON\/OFF|Near-field|Harmonic/i.test(test)), "Shared triage tests should be retained.");

const pim = taxonomy.classifyDesenseCase([
  { key: "Tx Correlated", value: "True" },
  { key: "Contact Structure", value: "Shield Can" },
  { key: "IM Product", value: "IM3 mentioned" },
]);
assert(pim.category === "TX-induced PIM Desense", `Expected PIM category; got ${pim.category}.`);

const backGlassScore = similar.calcSimilarity(
  [{ key: "Structure", value: "BackGlass" }],
  {
    id: "KB-TEST",
    title: "Back glass contact",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Back Glass contact issue",
    mitigation: "Adjust force",
    signatures: [
      { key: "Contact Structure", value: "Back Glass" },
      { key: "Contact Type", value: "Shield Can" },
    ],
  },
);
assert(backGlassScore >= 40, `Concept/weight based similarity should stay strong; got ${backGlassScore}.`);

const weightedScore = similar.calcSimilarity(
  [{ key: "Contact Structure", value: "Shield Can" }],
  {
    id: "KB-WEIGHT",
    title: "Shield can contact",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Shield can contact issue",
    mitigation: "Adjust contact",
    signatures: [{ key: "Contact Structure", value: "Shield Can" }],
  },
  [{ id: "custom-contact", signatureKey: "Contact Structure", analysisWeight: 3, retrievalWeight: 5, workflowWeight: 3, enabled: true, reason: "test", operationRule: "test", updatedAt: "2026-05-31T00:00:00.000Z" }],
);
assert(weightedScore === 100, `Custom retrieval weight should preserve exact-match scoring; got ${weightedScore}.`);

const bandAwareCases = [
  {
    id: "KB-SAME-BAND",
    title: "B3 shield can contact",
    model: "TEST",
    band: "B3",
    status: "confirmed",
    confirmedRootCause: "Shield can contact issue",
    mitigation: "Adjust contact",
    signatures: [
      { key: "Band", value: "B3" },
      { key: "Contact Structure", value: "Shield Can" },
      { key: "Contact Type", value: "Shield Can" },
    ],
  },
  {
    id: "KB-DIFFERENT-BAND",
    title: "B7 shield can contact",
    model: "TEST",
    band: "B7",
    status: "confirmed",
    confirmedRootCause: "Shield can contact issue",
    mitigation: "Adjust contact",
    signatures: [
      { key: "Band", value: "B7" },
      { key: "Contact Structure", value: "Shield Can" },
      { key: "Contact Type", value: "Shield Can" },
    ],
  },
];

const bandAwareResults = similar.findSimilarCases(
  [
    { key: "Band", value: "B3" },
    { key: "Contact Structure", value: "Shield Can" },
    { key: "Contact Type", value: "Shield Can" },
  ],
  15,
  2,
  undefined,
  bandAwareCases,
);
assert(bandAwareResults.some(item => item.id === "KB-DIFFERENT-BAND"), "Band mismatch case should not be excluded when analysis signatures match.");
assert(bandAwareResults[0].id === "KB-SAME-BAND", "Same-band case should rank ahead of band mismatch case.");
assert(
  bandAwareResults.find(item => item.id === "KB-DIFFERENT-BAND")?.bandMatch === "different",
  "Band mismatch metadata should be returned for UI badge.",
);

console.log("RF-FIP classification/similarity cleanup smoke passed.");
