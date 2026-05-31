import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-signature-concept-ontology");
const registryBundlePath = path.join(scratchDir, "signature-concept-registry.mjs");
const aliasBundlePath = path.join(scratchDir, "signature-alias-resolver.mjs");
const localBundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/signatureConceptRegistry.ts", registryBundlePath],
  ["client/src/lib/signatureAliasResolver.ts", aliasBundlePath],
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

const registry = await import(`${pathToFileURL(registryBundlePath).href}?t=${Date.now()}`);
const alias = await import(`${pathToFileURL(aliasBundlePath).href}?t=${Date.now()}`);
const local = await import(`${pathToFileURL(localBundlePath).href}?t=${Date.now()}`);
const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);

const backGlass = registry.resolveSignatureConcept({ key: "Structure", value: "백글" });
assert(backGlass?.conceptId === "mechanical.contact_structure", "Back Glass alias should resolve to contact structure concept.");
assert(backGlass?.valueId === "back_glass", "Back Glass alias should resolve to back_glass value id.");

const canonical = alias.canonicalizeSignatureTag({ key: "Contact Type", value: "backglass" });
assert(canonical.key === "Contact Structure" && canonical.value === "Back Glass", "Alias resolver should use the concept registry as canonical source.");
const genericBoolean = alias.canonicalizeSignatureTag({ key: "Drop History", value: "True" });
assert(genericBoolean.key === "Drop History" && genericBoolean.value === "True", "Generic boolean values should not be value-only canonicalized into unrelated concepts.");

const packet = local.buildLocalEvidencePacket({
  text: "B3 BackGlass 쪽 접촉 의심. conducted 미확인.",
  existingSignatures: [],
});
assert(packet.conceptRelationHints?.some(item => item.sourceConceptId === "mechanical.contact_structure"), "Local evidence should expose concept relation hints.");
assert(packet.missingInfo.includes("Pressure A/B test result"), "Contact structure relation should add pressure A/B missing info.");

const score = similar.calcSimilarity(
  [{ key: "Structure", value: "백글" }],
  {
    id: "KB-CONCEPT",
    title: "Back glass contact issue",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Back glass contact",
    mitigation: "Adjust contact",
    signatures: [{ key: "Contact Structure", value: "Back Glass" }],
  },
);
assert(score >= 70, "Concept-aware similarity should match key/value aliases strongly.");

console.log("RF-FIP signature concept ontology smoke passed.");
