import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-data-parser-ownership");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");
const seedBundlePath = path.join(scratchDir, "knowledge-seed-cases.mjs");
const importParserBundlePath = path.join(scratchDir, "import-parser.mjs");
const homePath = path.join(projectRoot, "client", "src", "pages", "Home.tsx");
const importAnalyzerPath = path.join(projectRoot, "client", "src", "lib", "importCandidateAnalyzer.ts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/similarCasesDb.ts", similarBundlePath],
  ["client/src/lib/knowledgeSeedCases.ts", seedBundlePath],
  ["client/src/lib/importParser.ts", importParserBundlePath],
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

const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);
const seed = await import(`${pathToFileURL(seedBundlePath).href}?t=${Date.now()}`);
const parser = await import(`${pathToFileURL(importParserBundlePath).href}?t=${Date.now()}`);
const homeSource = await fs.readFile(homePath, "utf8");
const importAnalyzerSource = await fs.readFile(importAnalyzerPath, "utf8");

assert(seed.DEFAULT_KNOWLEDGE_CASES.length >= 5, "Default Knowledge seed cases should live in the seed module.");

const query = [
  { key: "Band", value: "B3" },
  { key: "Contact Structure", value: "Shield Clip" },
  { key: "Tx Correlated", value: "True" },
];
assert(similar.findSimilarCases(query).length === 0, "Similarity engine should not own implicit seed data.");
assert(
  similar.findSimilarCases(query, 15, 4, undefined, seed.DEFAULT_KNOWLEDGE_CASES).length > 0,
  "Similarity caller should get results when it supplies Knowledge cases.",
);

const customProfile = {
  ...parser.DEFAULT_IMPORT_PARSER_PROFILE,
  caseHeaders: ["ticket", ...parser.DEFAULT_IMPORT_PARSER_PROFILE.caseHeaders],
  titleHeaders: ["ticket", ...parser.DEFAULT_IMPORT_PARSER_PROFILE.titleHeaders],
};
const customCsv = "ticket,observation\nRF-1,B3 Tx desense with shield clip";
const customSources = await parser.readImportFile(new File([customCsv], "custom.csv", { type: "text/csv" }), customProfile);
assert(customSources.length === 1, "Custom parser profile should classify ticket as a case header.");
assert(customSources[0].title === "RF-1", "Custom parser profile should use ticket as the title field.");

assert(!homeSource.includes("function extractRawCasesFromFile"), "Home should not keep a second import parser implementation.");
assert(!homeSource.includes("readImportFile(file)"), "Home should not call the parser directly after Import analyzer extraction.");
assert(importAnalyzerSource.includes("readImportFile(file)"), "Import analyzer should use the shared import parser.");

console.log("RF-FIP data/parser ownership smoke passed.");
