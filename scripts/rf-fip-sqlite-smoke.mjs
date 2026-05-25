import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const serverEntry = path.join(projectRoot, "dist", "index.js");
const port = Number(process.env.RF_FIP_SQLITE_SMOKE_PORT ?? 3323);
const dbDir = path.join(projectRoot, ".rf-fip-db", `smoke-sqlite-${Date.now()}`);
const baseUrl = `http://127.0.0.1:${port}`;

if (!fs.existsSync(serverEntry)) {
  throw new Error("dist/index.js not found. Run the server bundle command before SQLite smoke.");
}

function startServer() {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      RF_FIP_DB_DIR: dbDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return { child, stderr: () => stderr };
}

async function stopServer(server) {
  if (!server.child.killed) server.child.kill();
  await new Promise(resolve => setTimeout(resolve, 250));
  if (server.stderr().trim()) console.error(server.stderr().trim());
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${pathname} failed: ${response.status} ${text}`);
  }
  return json;
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const health = await request("/api/health");
      if (health.ok) return health;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error("Timed out waiting for /api/health");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let server = startServer();
try {
  const health = await waitForHealth();
  assert(health.storage?.engine === "sqlite", "Storage engine is not sqlite.");
  assert(String(health.storage?.dbPath ?? "").endsWith("rf-fip.sqlite"), "SQLite DB path did not use rf-fip.sqlite.");

  const issue = {
    id: "sqlite-issue-1",
    title: "SQLite issue",
    model: "SM-G998",
    status: "active",
    band: "LTE B3",
    createdAt: new Date().toISOString(),
    assignee: "Harness",
    messages: [],
    signatures: [{ key: "band", value: "LTE B3" }],
    hypotheses: [],
  };
  await request("/api/issues", { method: "POST", body: JSON.stringify(issue) });

  const knowledgeCase = {
    id: "sqlite-case-1",
    title: "SQLite knowledge case",
    model: "SM-G998",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Shield clip PIM",
    mitigation: "Increase clip force",
    signatures: [{ key: "symptom", value: "TRP drop" }],
  };
  await request("/api/knowledge-cases", { method: "POST", body: JSON.stringify(knowledgeCase) });
  await request("/api/signature-dictionary", {
    method: "PUT",
    body: JSON.stringify({ items: [{ key: "structure", value: "Shield Clip" }] }),
  });
  await request("/api/import-results", {
    method: "POST",
    body: JSON.stringify({
      id: "sqlite-import-1",
      createdAt: new Date().toISOString(),
      sourceFileNames: ["sqlite.csv"],
      approvedCaseIds: [knowledgeCase.id],
      skippedDuplicateCaseIds: [],
      heldCount: 0,
      candidateCount: 1,
    }),
  });

  await stopServer(server);
  server = startServer();
  await waitForHealth();

  const issues = await request("/api/issues");
  const cases = await request("/api/knowledge-cases");
  const dictionary = await request("/api/signature-dictionary");
  const imports = await request("/api/import-results");
  assert(issues.items?.some((item) => item.id === issue.id), "Issue was not persisted across restart.");
  assert(cases.items?.some((item) => item.id === knowledgeCase.id), "Knowledge case was not persisted across restart.");
  assert(dictionary.items?.[0]?.value === "Shield Clip", "Signature dictionary was not persisted across restart.");
  assert(imports.items?.some((item) => item.id === "sqlite-import-1"), "Import result was not persisted across restart.");
  assert(fs.existsSync(path.join(dbDir, "rf-fip.sqlite")), "SQLite file was not created.");

  console.log(`RF-FIP SQLite smoke passed: ${dbDir}`);
} finally {
  await stopServer(server);
}
