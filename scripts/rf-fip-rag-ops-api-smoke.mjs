import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", `smoke-rag-ops-api-${Date.now()}`);
const apiBundlePath = path.join(scratchDir, "rf-fip-api.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeReq(url, method = "GET") {
  const req = new EventEmitter();
  req.url = url;
  req.method = method;
  return req;
}

function makeRes() {
  const res = new EventEmitter();
  res.statusCode = 0;
  res.headers = {};
  res.body = "";
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    res.headers = headers;
  };
  res.end = (body = "") => {
    res.body = String(body);
    res.emit("finish");
  };
  return res;
}

await fs.mkdir(scratchDir, { recursive: true });
process.env.RF_FIP_DB_DIR = scratchDir;

await build({
  entryPoints: [path.join(projectRoot, "server", "rfFipApi.ts")],
  outfile: apiBundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const api = await import(`${pathToFileURL(apiBundlePath).href}?t=${Date.now()}`);

const res = makeRes();
const handled = await api.handleRfFipApiRequest(makeReq("/api/rag/ops-report"), res);
assert(handled === true, "RAG ops API route should be handled.");
assert(res.statusCode === 200, `RAG ops API should return 200, got ${res.statusCode}: ${res.body}`);
const payload = JSON.parse(res.body);
assert(payload.report?.verdict === "PASS", `Expected PASS verdict, got ${payload.report?.verdict}`);
assert(payload.report.counts.publicWikiDocuments >= 20, "RAG ops API should include public wiki count.");
assert(Array.isArray(payload.report.warnings), "RAG ops API should include warnings array.");
assert(Array.isArray(payload.report.errors), "RAG ops API should include errors array.");
assert(!JSON.stringify(payload).includes("GAUSS_WIKI_API_KEY"), "RAG ops API must not expose secret env names or values beyond policy text.");

console.log("RF-FIP RAG ops API smoke passed.");
