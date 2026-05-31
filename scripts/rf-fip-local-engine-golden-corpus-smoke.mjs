import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-local-engine-golden-corpus");
const sharedBundlePath = path.join(scratchDir, "rf-fip-rule-catalog.mjs");
const localBundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasTag(tags, key, value) {
  return tags.some(tag => tag.key === key && (value === undefined || tag.value === value));
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["shared/rfFipRuleCatalog.ts", sharedBundlePath],
  ["client/src/lib/localRfAnalyzer.ts", localBundlePath],
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

assert(!shared.hasRfAnalysisIntent("당신은 누구입니까?", 0), "General Korean chat should not be RF intent.");
assert(shared.hasRfAnalysisIntent("B3 송신 23dBm에서 감도저하 발생", 0), "Korean RF text should be RF intent.");

const koreanMechanical = "B3 송신 23dBm에서 감도저하 발생. 백글라스 가압하면 OTA TIS fail이 개선됨.";
const koreanMechanicalTags = shared.extractCoreRfSignatures(koreanMechanical);
assert(hasTag(koreanMechanicalTags, "Band", "B3"), "Korean mechanical case should extract Band.");
assert(hasTag(koreanMechanicalTags, "Tx Power", "23dBm"), "Korean mechanical case should extract Tx Power.");
assert(hasTag(koreanMechanicalTags, "Desense Type", "Sensitivity Drop"), "Korean mechanical case should extract desense type.");
assert(hasTag(koreanMechanicalTags, "Contact Structure", "Back Glass"), "Korean mechanical case should extract Back Glass.");
assert(hasTag(koreanMechanicalTags, "Pressure Sensitive", "True"), "Korean mechanical case should extract pressure sensitivity.");

const koreanPacket = local.buildLocalEvidencePacket({
  text: koreanMechanical,
  existingSignatures: [],
});
assert(koreanPacket.classification === "PIM/접촉 비선형" || koreanPacket.classification === "TX-induced PIM Desense", `Unexpected Korean mechanical classification: ${koreanPacket.classification}`);
assert(koreanPacket.diagnosticTests.some(test => test.includes("압력") || test.includes("Pressure")), "Korean mechanical case should recommend pressure/contact A/B testing.");

const englishBackGlass = "BackGlass pressure A/B changes B5 OTA sensitivity drop after reassembly.";
const englishTags = local.extractRfSignatures(englishBackGlass);
assert(hasTag(englishTags, "Contact Structure", "Back Glass"), "BackGlass should normalize to Back Glass contact structure.");
assert(hasTag(englishTags, "Reassembly Effect", "Disappears"), "Reassembly clue should be extracted.");

const internalNoise = "PMIC DCDC broadband noise floor and MIPI display spur cause B7 sensitivity loss.";
const internalPacket = local.buildLocalEvidencePacket({
  text: internalNoise,
  existingSignatures: [],
});
assert(hasTag(internalPacket.extractedTags, "Noise Source", "PMIC/DCDC"), "Internal noise case should extract PMIC/DCDC source.");
assert(internalPacket.classification === "Internal Desense / Spurious", `Internal noise case should classify as internal desense, got ${internalPacket.classification}`);

const conductedOta = "Conducted RX normal but OTA TIS fail in chamber for B1.";
const conductedPacket = local.buildLocalEvidencePacket({
  text: conductedOta,
  existingSignatures: [],
});
assert(hasTag(conductedPacket.extractedTags, "Conducted Result", "Normal"), "Conducted normal should be extracted.");
assert(hasTag(conductedPacket.extractedTags, "OTA Result", "Fail"), "OTA fail should be extracted.");
assert(conductedPacket.classification === "Antenna/기구 Coupling", `Conducted/OTA split should classify as antenna/mechanical coupling, got ${conductedPacket.classification}`);

const caPim = "B3+B7 CA Tx high power IM3 PIM channel fail.";
const caPimPacket = local.buildLocalEvidencePacket({
  text: caPim,
  existingSignatures: [],
});
assert(hasTag(caPimPacket.extractedTags, "CA Combo", "B3+B7"), "CA combo should be extracted.");
assert(hasTag(caPimPacket.extractedTags, "IM Product", "IM3 mentioned"), "IM3 should be extracted.");
assert(caPimPacket.classification === "TX-induced PIM Desense", `CA PIM case should classify as TX-induced PIM, got ${caPimPacket.classification}`);

const reply = local.generateLocalRfReply({
  text: koreanMechanical,
  existingSignatures: [],
});
assert(reply.content.includes("우선 분류:"), "Local reply should keep Korean user-facing heading.");
assert(!reply.content.includes("?�"), "Local reply should not include replacement-character mojibake.");

console.log("RF-FIP Local Engine golden corpus smoke passed.");
