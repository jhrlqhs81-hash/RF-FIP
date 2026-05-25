import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const errors = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

function lines(relativePath) {
  return read(relativePath).split(/\r?\n/);
}

function walk(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".rf-fip-db", ".git"].includes(entry.name)) continue;
      walk(full, predicate, output);
      continue;
    }
    if (predicate(full)) output.push(full);
  }
  return output;
}

function rel(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, "/");
}

const requiredDocs = [
  "docs/README.md",
  "docs/PRD.md",
  "docs/ARCHITECTURE.md",
  "docs/DATA_MODEL.md",
  "docs/API_CONTRACTS.md",
  "docs/UI_UX_SPEC.md",
  "docs/RF_DOMAIN_SPEC.md",
  "docs/IMPORT_SPEC.md",
  "docs/LLM_GAUSS_CONTRACT.md",
  "docs/TEST_PLAN.md",
  "docs/REGRESSION_CHECKLIST.md",
  "docs/HARNESS_POLICY.md",
];

for (const doc of requiredDocs) {
  if (!exists(doc)) errors.push(`Missing required doc: ${doc}`);
}

const agentFiles = walk(root, (file) => path.basename(file).toLowerCase() === "agents.md");
for (const file of agentFiles) {
  const relative = rel(file);
  const sameDirRules = path.join(path.dirname(file), "rules.md");
  if (!fs.existsSync(sameDirRules)) errors.push(`${relative} has no same-directory rules.md`);
  if (!read(relative).includes("rules.md")) errors.push(`${relative} does not reference rules.md`);
  const count = lines(relative).length;
  if (count > 70) errors.push(`${relative} exceeds 70 lines (${count})`);
}

const claudeFiles = walk(root, (file) => path.basename(file).toLowerCase() === "claude.md");
for (const file of claudeFiles) {
  const relative = rel(file);
  const count = lines(relative).length;
  if (count > 70) errors.push(`${relative} exceeds 70 lines (${count})`);
}

if (!exists("phases/index.json")) {
  errors.push("Missing phases/index.json");
} else {
  const phaseIndex = JSON.parse(read("phases/index.json"));
  for (const item of phaseIndex.phases ?? []) {
    const taskDir = `phases/${item.dir}`;
    const taskIndexPath = `${taskDir}/index.json`;
    if (!exists(taskIndexPath)) {
      errors.push(`Missing ${taskIndexPath}`);
      continue;
    }
    const taskIndex = JSON.parse(read(taskIndexPath));
    for (const step of taskIndex.steps ?? []) {
      const stepPath = `${taskDir}/step${step.step}.md`;
      if (!exists(stepPath)) {
        errors.push(`Missing ${stepPath}`);
        continue;
      }
      const content = read(stepPath);
      for (const marker of ["## 읽어야 할 파일", "## 작업", "## Acceptance Criteria", "## 검증 절차", "## 금지사항"]) {
        if (!content.includes(marker)) errors.push(`${stepPath} missing section: ${marker}`);
      }
      if (!content.includes("docs/") && !content.includes("`../docs/")) {
        errors.push(`${stepPath} does not reference docs`);
      }
    }
  }
}

if (errors.length) {
  console.error(["Harness policy check failed:", ...errors.map((item) => `- ${item}`)].join("\n"));
  process.exit(1);
}

console.log(`Harness policy check passed: ${requiredDocs.length} docs, ${agentFiles.length} AGENTS files`);
