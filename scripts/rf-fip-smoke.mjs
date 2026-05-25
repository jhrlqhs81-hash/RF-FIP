import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const serverEntry = path.join(projectRoot, "dist", "index.js");
const port = Number(process.env.RF_FIP_SMOKE_PORT ?? 3321);
const dbDir = path.join(projectRoot, ".rf-fip-db", `smoke-baseline-${Date.now()}`);
const baseUrl = `http://127.0.0.1:${port}`;

if (!fs.existsSync(serverEntry)) {
  throw new Error("dist/index.js not found. Run the server bundle command before smoke.");
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

try {
  const health = await waitForHealth();
  assert(String(health.storage?.dbPath ?? "").startsWith(dbDir), "Smoke server did not use smoke DB dir.");

  const issue = {
    id: "smoke-issue-1",
    title: "Smoke issue",
    model: "SM-G998",
    status: "active",
    band: "LTE B3",
    createdAt: new Date().toISOString(),
    assignee: "Harness",
    messages: [],
    signatures: [{ key: "band", value: "LTE B3" }],
    hypotheses: [],
  };
  const savedIssue = await request("/api/issues", { method: "POST", body: JSON.stringify(issue) });
  assert(savedIssue.item?.id === issue.id, "Issue POST did not echo saved item.");
  const issues = await request("/api/issues");
  assert(issues.items?.some((item) => item.id === issue.id), "Issue GET did not include saved issue.");

  const knowledgeCase = {
    id: "smoke-case-1",
    title: "Smoke knowledge case",
    model: "SM-G998",
    band: "LTE B3",
    status: "confirmed",
    confirmedRootCause: "Antenna feed mismatch",
    mitigation: "Retune matching network",
    signatures: [{ key: "symptom", value: "TRP drop" }],
  };
  const savedCase = await request("/api/knowledge-cases", {
    method: "POST",
    body: JSON.stringify(knowledgeCase),
  });
  assert(savedCase.item?.id === knowledgeCase.id, "Knowledge case POST did not echo saved item.");
  const cases = await request("/api/knowledge-cases");
  assert(cases.items?.some((item) => item.id === knowledgeCase.id), "Knowledge case GET did not include saved case.");

  const dictionary = [{ key: "structure", value: "ANT-MAIN" }];
  const savedDictionary = await request("/api/signature-dictionary", {
    method: "PUT",
    body: JSON.stringify({ items: dictionary }),
  });
  assert(savedDictionary.items?.length === 1, "Signature dictionary PUT count mismatch.");
  const loadedDictionary = await request("/api/signature-dictionary");
  assert(loadedDictionary.items?.[0]?.key === "structure", "Signature dictionary GET mismatch.");

  const importResult = {
    id: "smoke-import-1",
    createdAt: new Date().toISOString(),
    sourceFileNames: ["smoke.txt"],
    approvedCaseIds: [knowledgeCase.id],
    skippedDuplicateCaseIds: [],
    heldCount: 0,
    candidateCount: 1,
  };
  const savedImport = await request("/api/import-results", {
    method: "POST",
    body: JSON.stringify(importResult),
  });
  assert(savedImport.item?.id === importResult.id, "Import result POST did not echo saved item.");
  const imports = await request("/api/import-results");
  assert(imports.items?.some((item) => item.id === importResult.id), "Import result GET did not include saved result.");

  console.log(`RF-FIP smoke passed: ${dbDir}`);
} finally {
  child.kill();
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
}
