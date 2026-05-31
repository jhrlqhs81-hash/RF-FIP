import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "smoke-signature-alias-dictionary");
const aliasBundlePath = path.join(scratchDir, "signature-alias-resolver.mjs");
const localBundlePath = path.join(scratchDir, "local-rf-analyzer.mjs");
const similarBundlePath = path.join(scratchDir, "similar-cases-db.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(scratchDir, { recursive: true });
for (const [entry, outfile] of [
  ["client/src/lib/signatureAliasResolver.ts", aliasBundlePath],
  ["client/src/lib/localRfAnalyzer.ts", localBundlePath],
  ["client/src/lib/similarCasesDb.ts", similarBundlePath],
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

const alias = await import(`${pathToFileURL(aliasBundlePath).href}?t=${Date.now()}`);
const local = await import(`${pathToFileURL(localBundlePath).href}?t=${Date.now()}`);
const similar = await import(`${pathToFileURL(similarBundlePath).href}?t=${Date.now()}`);

const overlay = [
  {
    id: "user-rear-window",
    canonicalKey: "Contact Structure",
    canonicalValue: "Back Glass",
    aliases: ["rear window", "rearwindow"],
    domain: "mechanical",
    status: "approved",
    confidence: 0.95,
    source: "user-approved",
  },
  {
    id: "pending-rear-lid",
    canonicalKey: "Contact Structure",
    canonicalValue: "Back Glass",
    aliases: ["rear lid"],
    domain: "mechanical",
    status: "pending",
    confidence: 0.8,
    source: "imported",
  },
];

const merged = alias.mergeSignatureAliasDictionaries(overlay);
assert(merged.some(entry => entry.source === "user-approved" && entry.aliases.includes("rear window")), "Persisted approved alias should merge with builtin aliases.");

const approved = local.extractRfSignatures("B3 rearwindow pressure sensitive desense", overlay);
assert(approved.some(tag => tag.key === "Contact Structure" && tag.value === "Back Glass"), "Approved persisted alias should canonicalize.");
assert(approved.some(tag => tag.key === "Desense Type" && tag.value === "Sensitivity Drop"), "Builtin symptom alias should still canonicalize.");

const pending = local.extractRfSignatures("B3 rear lid pressure issue", overlay);
assert(!pending.some(tag => tag.key === "Contact Structure" && tag.value === "Back Glass"), "Pending alias must not auto-canonicalize.");

const builtin = local.extractRfSignatures("백글라스 conducted cable rx TIS fail chamber fail noise floor spur broadband noise channel-specific fail 2-tone PIM");
assert(builtin.some(tag => tag.key === "Contact Structure" && tag.value === "Back Glass"), "Korean Back Glass alias should resolve.");
assert(builtin.some(tag => tag.key === "Conducted Result" && tag.value === "Check required"), "Conducted alias should resolve.");
assert(builtin.some(tag => tag.key === "OTA Result" && tag.value === "Fail"), "OTA fail alias should resolve.");
assert(builtin.some(tag => tag.key === "Desense Type" && tag.value === "Noise Floor Rise"), "Noise floor symptom should resolve.");
assert(builtin.some(tag => tag.key === "Desense Type" && tag.value === "Spur"), "Spur symptom should resolve.");
assert(builtin.some(tag => tag.key === "Desense Type" && tag.value === "Broadband Noise"), "Broadband noise symptom should resolve.");
assert(builtin.some(tag => tag.key === "Desense Type" && tag.value === "Channel-specific Fail"), "Channel-specific symptom should resolve.");
assert(builtin.some(tag => tag.key === "Diagnostic Gate" && tag.value === "2-tone PIM test"), "2-tone PIM test alias should resolve.");

const genericBoolean = alias.canonicalizeSignatureTag({ key: "Drop History", value: "True" }, overlay);
assert(genericBoolean.key === "Drop History" && genericBoolean.value === "True", "Generic True must not value-only canonicalize.");

const score = similar.calcSimilarity(
  [{ key: "Structure", value: "rearwindow" }],
  {
    id: "KB-ALIAS",
    title: "Back glass",
    model: "TEST",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Back glass contact issue",
    mitigation: "Adjust force",
    signatures: [{ key: "Contact Structure", value: "Back Glass" }],
  },
  undefined,
  overlay,
);
assert(score >= 70, `Similarity should use approved alias overlay; got ${score}.`);

const packet = local.buildLocalEvidencePacket({
  text: "rearwindow desense with pressure",
  existingSignatures: [],
  signatureAliasDictionary: overlay,
});
assert(packet.extractedTags.some(tag => tag.key === "Contact Structure" && tag.value === "Back Glass"), "Local evidence packet should use approved alias overlay.");

console.log("RF-FIP signature alias dictionary smoke passed.");
