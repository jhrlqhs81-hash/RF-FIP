import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-attachment-evidence");
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

const { buildAttachmentEvidence, buildLocalEvidencePacket } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const attachments = [{
  id: "att-table-1",
  type: "table",
  name: "rx-sweep.csv",
  rows: [
    ["Condition", "Result"],
    ["Tx 23dBm", "RX sensitivity desense 4dB"],
  ],
}];

const evidence = buildAttachmentEvidence(attachments);
const packet = buildLocalEvidencePacket({
  text: "B3 desense under Tx",
  existingSignatures: [],
  attachments,
});

assert(evidence.length >= 2, "Attachment evidence should include table metadata and RF keyword fact.");
assert(evidence.every(item => item.source === "attachment"), "Attachment evidence source must be attachment.");
assert(packet.evidence.some(item => item.type === "attachment"), "Evidence packet should include attachment-derived evidence.");

console.log("RF-FIP attachment evidence smoke passed.");
