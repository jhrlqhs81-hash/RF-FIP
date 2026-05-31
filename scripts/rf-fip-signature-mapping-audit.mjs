import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "signature-mapping-audit");
const registryBundlePath = path.join(scratchDir, "signature-concept-registry.mjs");
const groupBundlePath = path.join(scratchDir, "signature-tag-groups.mjs");
const seedBundlePath = path.join(scratchDir, "knowledge-seed-cases.mjs");
const mockBundlePath = path.join(scratchDir, "mock-data.mjs");

const metadataKeys = new Set([
  "rat",
  "band",
  "degradation",
  "unit scope",
  "tx threshold",
]);

const narrativeKeys = new Set([
  "mechanism",
  "desense category",
  "pim risk",
  "thermal sensitive",
  "thermal dependent",
  "surface condition",
  "thb history",
  "temporal pattern",
  "mechanical stress",
  "drop history",
  "onset condition",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function actionFor(tag, status) {
  const key = normalize(tag.key);
  if (status.kind === "mapped") return "ok";
  if (status.kind === "key-only") return "add-value-alias";
  if (metadataKeys.has(key)) return "move-to-metadata-or-display-only";
  if (narrativeKeys.has(key)) return "move-to-rca-attribute";
  return "review-concept-or-alias";
}

function classify(tag, registry) {
  const concept = registry.describeSignatureConcept(tag);
  if (!concept) return { kind: "unmapped" };
  if ("valueId" in concept && concept.valueId) {
    return {
      kind: "mapped",
      conceptId: concept.conceptId,
      valueId: concept.valueId,
      path: concept.path,
    };
  }
  return {
    kind: "key-only",
    conceptId: concept.conceptId,
    path: concept.path,
  };
}

function collectSignatures(seed, mock) {
  const rows = [];
  for (const item of seed.DEFAULT_KNOWLEDGE_CASES ?? []) {
    for (const signature of item.signatures ?? []) {
      rows.push({ source: "knowledge-seed", ownerId: item.id, signature });
    }
  }
  for (const item of mock.MOCK_ISSUES ?? []) {
    for (const signature of item.signatures ?? []) {
      rows.push({ source: "mock-issue", ownerId: item.id, signature });
    }
  }
  return rows;
}

function summarize(records) {
  const totals = { mapped: 0, keyOnly: 0, unmapped: 0 };
  const actions = new Map();
  const examples = new Map();

  for (const record of records) {
    if (record.status.kind === "mapped") totals.mapped += 1;
    if (record.status.kind === "key-only") totals.keyOnly += 1;
    if (record.status.kind === "unmapped") totals.unmapped += 1;
    actions.set(record.action, (actions.get(record.action) ?? 0) + 1);
    const id = `${record.signature.key}:${record.signature.value}`;
    if (!examples.has(id)) examples.set(id, record);
  }

  return {
    totals,
    actions: Object.fromEntries([...actions.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    examples: [...examples.values()]
      .filter(item => item.status.kind !== "mapped")
      .sort((a, b) => a.action.localeCompare(b.action) || a.signature.key.localeCompare(b.signature.key))
      .slice(0, 30),
  };
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/signatureConceptRegistry.ts", registryBundlePath],
  ["client/src/lib/signatureTagGroups.ts", groupBundlePath],
  ["client/src/lib/knowledgeSeedCases.ts", seedBundlePath],
  ["client/src/lib/mockData.ts", mockBundlePath],
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
const groups = await import(`${pathToFileURL(groupBundlePath).href}?t=${Date.now()}`);
const seed = await import(`${pathToFileURL(seedBundlePath).href}?t=${Date.now()}`);
const mock = await import(`${pathToFileURL(mockBundlePath).href}?t=${Date.now()}`);

for (const signature of [
  { key: "RAT", value: "LTE" },
  { key: "Band", value: "B3" },
  { key: "Degradation", value: "3dB" },
  { key: "Unit Scope", value: "Single unit" },
  { key: "Tx Threshold", value: "20 dBm" },
]) {
  assert(groups.isMetadataSignature(signature), `${signature.key} should be classified as metadata.`);
}

for (const signature of [
  { key: "Mechanism", value: "Contact nonlinearity IM3" },
  { key: "Desense Category", value: "TX-induced PIM Desense" },
  { key: "PIM Risk", value: "High" },
]) {
  assert(groups.isNarrativeSignature(signature), `${signature.key} should be classified as RCA/narrative.`);
}

const records = collectSignatures(seed, mock).map(row => {
  const status = classify(row.signature, registry);
  return {
    ...row,
    status,
    action: actionFor(row.signature, status),
  };
});

const summary = summarize(records);

const expectedMapped = [
  { key: "Tx Dependency", value: "High power only" },
  { key: "IM Product", value: "IM3 overlaps B3 DL" },
  { key: "IM Order", value: "IM3" },
  { key: "Diagnostic Gate", value: "Display ON/OFF + harmonic scan" },
  { key: "Trigger", value: "Display ON" },
  { key: "Spur Source", value: "Display MIPI" },
  { key: "Antenna Path", value: "Antenna Feed" },
  { key: "Reassembly", value: "Disappears" },
];

for (const signature of expectedMapped) {
  const status = classify(signature, registry);
  assert(status.kind === "mapped", `${signature.key}:${signature.value} should be fully mapped, got ${status.kind}.`);
}

const reviewCount = summary.actions["review-concept-or-alias"] ?? 0;
assert(reviewCount <= 2, `Too many unclassified unmapped signatures require review: ${reviewCount}.`);

console.log("RF-FIP signature mapping audit passed.");
console.log(JSON.stringify(summary, null, 2));
