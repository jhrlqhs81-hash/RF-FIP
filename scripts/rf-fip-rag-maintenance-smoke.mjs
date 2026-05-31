import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const wikiDir = path.join(projectRoot, "docs", "rf-wiki");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-rag-maintenance");
const ragBundlePath = path.join(scratchDir, "rf-fip-rag.mjs");
const requiredMeta = [
  "id",
  "title",
  "sourceType",
  "securityClass",
  "allowedProviders",
  "conceptIds",
  "signatureKeys",
  "version",
  "updatedAt",
  "owner",
  "reviewDue",
];
function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = localIsoDate();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseFrontMatter(content) {
  assert(content.startsWith("---"), "RAG wiki document must start with frontmatter.");
  const end = content.indexOf("\n---", 3);
  assert(end > 0, "RAG wiki document frontmatter must close with ---.");
  const rawMeta = content.slice(3, end).trim();
  const body = content.slice(end + 4).trim();
  const meta = {};
  for (const line of rawMeta.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body };
}

function splitList(value) {
  return (value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

await fs.mkdir(scratchDir, { recursive: true });
const files = (await fs.readdir(wikiDir)).filter(file => file.endsWith(".md")).sort();
assert(files.length >= 20, "RAG wiki should include at least 20 public RF maintenance documents.");

const ids = new Set();
for (const file of files) {
  const fullPath = path.join(wikiDir, file);
  const { meta, body } = parseFrontMatter(await fs.readFile(fullPath, "utf8"));
  for (const key of requiredMeta) assert(meta[key], `${file} missing required RAG metadata: ${key}`);
  assert(!ids.has(meta.id), `${file} duplicates RAG id: ${meta.id}`);
  ids.add(meta.id);
  assert(meta.sourceType === "local-public", `${file} must remain local-public until internal wiki contract exists.`);
  assert(meta.securityClass === "public-safe", `${file} must remain public-safe while eligible for OpenAI.`);
  assert(splitList(meta.allowedProviders).includes("openai"), `${file} public-safe document must explicitly allow openai.`);
  assert(splitList(meta.allowedProviders).includes("gauss"), `${file} public-safe document must explicitly allow gauss handoff.`);
  assert(splitList(meta.conceptIds).length > 0, `${file} must map to at least one conceptId.`);
  assert(splitList(meta.signatureKeys).length > 0, `${file} must map to at least one signatureKey.`);
  assert(isIsoDate(meta.updatedAt), `${file} updatedAt must use YYYY-MM-DD.`);
  assert(isIsoDate(meta.reviewDue), `${file} reviewDue must use YYYY-MM-DD.`);
  assert(meta.reviewDue > today, `${file} reviewDue is stale and needs RF domain review.`);
  assert(body.length >= 120, `${file} body is too short to be useful as RAG reference.`);
}

await build({
  entryPoints: [path.join(projectRoot, "server", "rfFipRag.ts")],
  outfile: ragBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

process.env.RF_FIP_RAG_WIKI_DIR = wikiDir;
const rag = await import(`${pathToFileURL(ragBundlePath).href}?t=${Date.now()}`);

function expectGoldenQuery({ name, text, signatures = [], expectedAny }) {
  const context = rag.retrieveKnowledgeContext({
    provider: "openai",
    task: "chat-reply",
    text,
    signatures,
    maxSnippets: 4,
  });
  const ids = context.snippets.map(item => item.id);
  assert(context.snippets.length > 0, `${name} did not retrieve any RAG snippets.`);
  assert(context.snippets.every(item => item.securityClass === "public-safe"), `${name} returned non-public-safe snippet.`);
  assert(expectedAny.some(id => ids.includes(id)), `${name} expected one of ${expectedAny.join(", ")} but got ${ids.join(", ")}`);
  assert(context.snippets.every(item => item.owner && item.reviewDue), `${name} snippet metadata omitted owner/reviewDue.`);
}

expectGoldenQuery({
  name: "tx-contact-pressure",
  text: "B3 Tx desense with BackGlass shield contact and pressure A/B needed",
  signatures: [{ key: "Contact Structure", value: "Back Glass" }],
  expectedAny: ["wiki-tx-induced-pim", "wiki-mechanical-pressure-ab"],
});

expectGoldenQuery({
  name: "conducted-normal-ota-fail",
  text: "Conducted RX baseline is normal but OTA TIS fail remains",
  signatures: [{ key: "Conducted Result", value: "Normal" }, { key: "OTA Result", value: "Fail" }],
  expectedAny: ["wiki-conducted-vs-ota"],
});

expectGoldenQuery({
  name: "ca-im-product",
  text: "CA combo channel specific fail needs IM3 IM5 frequency calculation",
  signatures: [{ key: "IM Product", value: "Check required" }],
  expectedAny: ["wiki-im-frequency-check"],
});

expectGoldenQuery({
  name: "function-spur",
  text: "MIPI camera function ON OFF causes narrow spur and desense",
  signatures: [{ key: "Noise Source", value: "MIPI" }],
  expectedAny: [
    "wiki-internal-spur-function-on-off",
    "wiki-mipi-display-spur",
    "wiki-camera-usb-ddr-spur",
    "wiki-pmic-dcdc-broadband-noise",
    "wiki-charging-noise-coupling",
  ],
});

expectGoldenQuery({
  name: "antenna-feed-matching",
  text: "OTA sensitivity loss with normal conducted RX needs antenna feed matching return loss VSWR check",
  signatures: [{ key: "Antenna Feed", value: "Check required" }, { key: "Return Loss", value: "Check required" }],
  expectedAny: ["wiki-antenna-feed-matching"],
});

expectGoldenQuery({
  name: "antenna-ground-clearance",
  text: "Antenna keepout and ground clearance changed near metal bracket causing OTA TIS fail",
  signatures: [{ key: "Ground Clearance", value: "Check required" }, { key: "Antenna Keepout", value: "Check required" }],
  expectedAny: ["wiki-antenna-ground-clearance"],
});

expectGoldenQuery({
  name: "shield-can-grounding",
  text: "Shield can edge pressure improves desense and shielding A/B changes noise floor",
  signatures: [{ key: "Shield Can", value: "Leakage" }, { key: "Shielding A/B", value: "Improved" }],
  expectedAny: ["wiki-shield-can-leakage"],
});

expectGoldenQuery({
  name: "spring-contact-fatigue",
  text: "Spring contact fatigue after repeated assembly shows contact force loss and pressure sensitivity",
  signatures: [{ key: "Spring Contact", value: "Fatigue" }, { key: "Contact Force", value: "Low" }],
  expectedAny: ["wiki-spring-contact-fatigue"],
});

expectGoldenQuery({
  name: "fpc-contact-intermittent",
  text: "FPC contact intermittent RF path changes after connector reseat and bend A/B",
  signatures: [{ key: "FPC Contact", value: "Intermittent" }, { key: "Reassembly Effect", value: "True" }],
  expectedAny: ["wiki-fpc-contact-intermittent"],
});

expectGoldenQuery({
  name: "ground-strap-corrosion",
  text: "Ground strap corrosion after THB raises ground impedance and improves after cleaning",
  signatures: [{ key: "Ground Strap", value: "Corrosion" }, { key: "Ground Impedance", value: "High" }],
  expectedAny: ["wiki-ground-strap-corrosion"],
});

expectGoldenQuery({
  name: "back-glass-assembly",
  text: "Back Glass assembly pressure changes OTA antenna path and reassembly effect appears",
  signatures: [{ key: "Back Glass", value: "Pressure sensitive" }, { key: "Antenna Path", value: "Affected" }],
  expectedAny: ["wiki-back-glass-assembly"],
});

expectGoldenQuery({
  name: "pmic-dcdc-broadband",
  text: "PMIC DCDC broadband noise floor rises during load sweep and charging state",
  signatures: [{ key: "PMIC", value: "Active" }, { key: "Broadband Noise", value: "Noise floor rise" }],
  expectedAny: ["wiki-pmic-dcdc-broadband-noise"],
});

expectGoldenQuery({
  name: "mipi-display-spur",
  text: "MIPI display ON changes narrow spur frequency and desense follows refresh rate",
  signatures: [{ key: "MIPI", value: "Display" }, { key: "Spur", value: "Narrow" }],
  expectedAny: ["wiki-mipi-display-spur", "wiki-internal-spur-function-on-off"],
});

expectGoldenQuery({
  name: "camera-usb-ddr-spur",
  text: "Camera USB DDR activity creates spur during function ON OFF and traffic sweep",
  signatures: [{ key: "Camera", value: "Active" }, { key: "USB", value: "Traffic" }, { key: "DDR", value: "Active" }],
  expectedAny: ["wiki-camera-usb-ddr-spur"],
});

expectGoldenQuery({
  name: "charging-noise-coupling",
  text: "Charging noise coupling appears only with charger cable and current sweep",
  signatures: [{ key: "Charging", value: "Active" }, { key: "Noise Coupling", value: "Check required" }],
  expectedAny: ["wiki-charging-noise-coupling"],
});

expectGoldenQuery({
  name: "filter-skirt-channel",
  text: "Channel specific fail near filter skirt needs frequency sweep and spur overlap check",
  signatures: [{ key: "Filter Skirt", value: "Suspect" }, { key: "Channel Specific", value: "True" }],
  expectedAny: ["wiki-filter-skirt-channel-fail"],
});

expectGoldenQuery({
  name: "lna-rf-chain-conducted",
  text: "Conducted RX fail indicates LNA RF chain gain step or front end path issue",
  signatures: [{ key: "LNA", value: "Check required" }, { key: "Conducted Result", value: "Fail" }],
  expectedAny: ["wiki-lna-rf-chain-conducted-fail"],
});

expectGoldenQuery({
  name: "chamber-fixture-validation",
  text: "OTA chamber fixture repeatability problem requires golden unit fixture swap and calibration check",
  signatures: [{ key: "Chamber", value: "Check required" }, { key: "Fixture", value: "Check required" }],
  expectedAny: ["wiki-chamber-fixture-validation"],
});

expectGoldenQuery({
  name: "mitigation-ab-validation",
  text: "Mitigation A/B validation should prove corrective action with repeatable before after evidence",
  signatures: [{ key: "Mitigation", value: "A/B required" }, { key: "Validation", value: "Check required" }],
  expectedAny: ["wiki-mitigation-ab-validation"],
});

const skipped = rag.retrieveKnowledgeContext({
  provider: "openai",
  task: "signature-normalize",
  text: "BackGlass Tx desense",
});
assert(skipped.snippets.length === 0, "RAG maintenance guard should keep signature-normalize out of RAG scope.");

console.log("RF-FIP RAG maintenance smoke passed.");
