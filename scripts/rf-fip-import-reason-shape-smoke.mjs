import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const homePath = path.join(projectRoot, "client", "src", "pages", "Home.tsx");
const source = await fs.readFile(homePath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes("interface ImportStatusDecision"), "ImportStatusDecision contract is missing.");
assert(source.includes("statusDecision: ImportStatusDecision"), "ImportCandidate does not expose statusDecision.");
assert(source.includes("buildImportStatusDecision"), "Import deterministic decision helper is missing.");
assert(source.includes("importFacts: statusDecision.facts"), "Import facts are not attached to candidates.");
assert(source.includes("localEvidencePacket"), "Import candidates do not retain Local Evidence Packet.");
assert(source.includes("findDuplicateImportCase"), "Duplicate matching flow was removed.");
assert(source.includes("ImportOriginalModal"), "Original view modal was removed.");

console.log("RF-FIP import reason shape smoke passed.");
