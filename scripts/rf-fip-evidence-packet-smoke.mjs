import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-evidence-packet");
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

const { buildLocalEvidencePacket, generateLocalRfReply } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const input = {
  text: "B3 RX sensitivity drops 4dB during Tx 23dBm with shield clip PIM IM3.",
  existingSignatures: [],
};
const packet = buildLocalEvidencePacket(input);
const reply = generateLocalRfReply(input);

assert(packet.version === 1, "Evidence packet version mismatch.");
assert(packet.extractedTags.some(tag => tag.key === "Band" && tag.value === "B3"), "Band signature was not extracted.");
assert(packet.classification, "Classification is missing.");
assert(packet.evidence.some(item => item.type === "classification"), "Classification evidence is missing.");
assert(packet.evidence.some(item => item.type === "diagnostic_test"), "Diagnostic test evidence is missing.");
assert(Array.isArray(packet.missingInfo), "Missing info must be an array.");
assert(reply.evidencePacket.version === 1, "Local reply did not include an evidence packet.");

console.log("RF-FIP evidence packet smoke passed.");
