import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-architecture-boundary");
const analyzerBundlePath = path.join(scratchDir, "import-candidate-analyzer.mjs");
const homePath = path.join(projectRoot, "client", "src", "pages", "Home.tsx");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "importCandidateAnalyzer.ts")],
  outfile: analyzerBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const analyzer = await import(`${pathToFileURL(analyzerBundlePath).href}?t=${Date.now()}`);
const homeSource = await fs.readFile(homePath, "utf8");

assert(!homeSource.includes("interface ImportCandidate"), "Home should not own ImportCandidate domain types.");
assert(!homeSource.includes("function buildImportCandidate"), "Home should not own Import candidate analysis.");
assert(!homeSource.includes("function findDuplicateImportCase"), "Home should not own Import duplicate scoring.");
assert(homeSource.includes("buildImportCandidatesFromFiles"), "Home should orchestrate Import through the analyzer boundary.");

const file = new File([
  "case,observation\nRF-101,B3 Tx 23dBm OTA sensitivity drop with shield can pressure A/B fail",
], "rf-import.csv", { type: "text/csv" });
const candidates = await analyzer.buildImportCandidatesFromFiles([file], { knowledgeCases: [] });
assert(candidates.length === 1, "Analyzer should create one Import candidate from one CSV case.");
assert(candidates[0].status === "candidate", "RF source should become a candidate.");
assert(candidates[0].localEvidencePacket?.evidence?.length > 0, "Candidate should keep a local evidence packet.");
assert(candidates[0].caseData.usedMaterials?.length === 1, "Candidate should keep source material evidence.");

const duplicate = analyzer.findDuplicateImportCase(candidates[0].caseData, [candidates[0].caseData]);
assert(duplicate.duplicate === true, "Duplicate detection should remain available from the analyzer boundary.");

console.log("RF-FIP architecture boundary smoke passed.");
