import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-signature-alias-resolver");
const bundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "localRfAnalyzer.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { extractRfSignatures, buildLocalEvidencePacket, mergeSignatures } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const signatures = extractRfSignatures("B3 BackGlass 백글라스 백글 가압 조건에서 RX sensitivity drop 3dB");
const backGlass = signatures.filter(tag => tag.key === "Contact Structure" && tag.value === "Back Glass");
assert(backGlass.length === 1, "BackGlass/백글라스/백글 aliases should resolve to one canonical Back Glass signature.");
assert(signatures.some(tag => tag.key === "Pressure Sensitive" && tag.value === "True"), "Pressure alias should resolve.");
assert(signatures.some(tag => tag.key === "Desense Type" && tag.value === "Sensitivity Drop"), "Sensitivity alias should resolve.");

const merged = mergeSignatures(
  [{ key: "Structure", value: "back glass" }],
  [{ key: "Contact Structure", value: "백글" }],
);
assert(merged.filter(tag => tag.key === "Contact Structure" && tag.value === "Back Glass").length === 1, "Merge should canonicalize approved aliases.");

const packet = buildLocalEvidencePacket({
  text: "백그라스 쪽 접촉 의심",
  existingSignatures: [],
});
assert(packet.pendingAliasCandidates?.some(candidate => candidate.canonicalValue === "Back Glass"), "Near alias should be recorded as pending candidate, not silently canonicalized.");

console.log("RF-FIP signature alias resolver smoke passed.");
