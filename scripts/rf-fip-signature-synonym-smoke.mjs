import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-signature-synonym");
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

const { extractRfSignatures, buildLocalEvidencePacket } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const text = "B3 수신 감도 저하 3dB. 차폐 캔 접촉압 가압 시 정상화, 재조립 후 개선. conducted 정상, OTA fail.";
const signatures = extractRfSignatures(text);
const packet = buildLocalEvidencePacket({ text, existingSignatures: [] });

function has(key, value) {
  return signatures.some(tag => tag.key === key && (!value || tag.value === value));
}

assert(has("Desense Type", "Sensitivity Drop"), "Korean sensitivity/desense synonym was not normalized.");
assert(has("Contact Structure", "Shield Can"), "Shield can synonym was not normalized.");
assert(has("Pressure Sensitive", "True"), "Contact force/pressure synonym was not normalized.");
assert(has("Reassembly Effect", "Disappears"), "Reassembly synonym was not normalized.");
assert(has("Conducted Result"), "Conducted synonym was not extracted.");
assert(has("OTA Result", "Fail"), "OTA synonym was not extracted.");
assert(packet.evidence.some(item => item.type === "signature"), "Synonym signatures should enter evidence packet.");

console.log("RF-FIP signature synonym smoke passed.");
