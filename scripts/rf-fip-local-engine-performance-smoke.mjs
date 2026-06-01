import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-local-engine-performance");
const aliasBundlePath = path.join(scratchDir, "signature-alias-resolver.mjs");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");
const localAnalyzerBundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");
const homePath = path.join(projectRoot, "client", "src", "pages", "Home.tsx");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "signatureAliasResolver.ts")],
  outfile: aliasBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "similarCasesDb.ts")],
  outfile: similarBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "localRfAnalyzer.ts")],
  outfile: localAnalyzerBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const alias = await import(`${pathToFileURL(aliasBundlePath).href}?t=${Date.now()}`);
const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);
const localAnalyzer = await import(`${pathToFileURL(localAnalyzerBundlePath).href}?t=${Date.now()}`);
const homeSource = await fs.readFile(homePath, "utf8");

const approved = alias.getApprovedAliasDictionary();
assert(approved.length > 0, "Approved alias dictionary should be available.");
assert(approved.every(entry => (entry.status ?? "approved") === "approved"), "Only approved aliases should be used for canonicalization.");

const canonical = alias.canonicalizeSignatures([
  { key: "Structure", value: "BackGlass" },
  { key: "Contact Structure", value: "back glass" },
]);
assert(canonical.length === 1, "Approved aliases should merge into one canonical signature.");
assert(canonical[0].key === "Contact Structure" && canonical[0].value === "Back Glass", "BackGlass should canonicalize to Contact Structure:Back Glass.");

const candidates = alias.findPendingAliasCandidates("backglas contact issue");
assert(candidates.some(item => item.canonicalValue === "Back Glass"), "Near aliases should be retained as pending candidates.");

const score = similar.calcSimilarity(
  [{ key: "Structure", value: "BackGlass" }],
  {
    id: "KB-TEST",
    title: "Back glass contact",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Back Glass contact issue",
    mitigation: "Adjust force",
    signatures: [
      { key: "Contact Structure", value: "Back Glass" },
      { key: "Contact Type", value: "Shield Can" },
    ],
  },
);
assert(score >= 40, `Alias-aware similarity should score strongly; got ${score}.`);

const customAliasDictionary = [{
  id: "local-engine-custom-alias",
  canonicalKey: "Contact Structure",
  canonicalValue: "Back Glass",
  aliases: ["bgcoverx"],
  domain: "rf",
  status: "approved",
  confidence: 0.96,
  source: "user-approved",
  aliasType: "semantic_alias",
  relationType: "alias",
}];
const packet = localAnalyzer.buildLocalEvidencePacket({
  text: "back glass pressure desense",
  existingSignatures: [],
  signatureAliasDictionary: customAliasDictionary,
  knowledgeCases: [{
    id: "KB-CUSTOM-ALIAS",
    title: "Custom alias back glass case",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Back glass contact",
    mitigation: "Adjust assembly force",
    signatures: [{ key: "Structure", value: "bgcoverx" }],
  }],
});
assert(packet.similarCases.some(item => item.id === "KB-CUSTOM-ALIAS"), "Local evidence packet should pass user-approved aliases into similar case retrieval.");
assert(homeSource.includes("pendingAliasCandidates: analysis.evidencePacket?.pendingAliasCandidates"), "Chat messages should preserve pending alias candidates.");
assert(homeSource.includes("pendingAliasCandidates: message.pendingAliasCandidates"), "Shared analysis context should include pending alias candidates.");

console.log("RF-FIP local engine performance smoke passed.");
