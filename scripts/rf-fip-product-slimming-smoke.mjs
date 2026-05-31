import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const homeSource = await fs.readFile(path.join(projectRoot, "client", "src", "pages", "Home.tsx"), "utf8");
const signaturePanelSource = await fs.readFile(
  path.join(projectRoot, "client", "src", "components", "SignaturePanel.tsx"),
  "utf8",
);

assert(!homeSource.includes("Demo: show table for specific message"), "Chat must not contain hardcoded demo table UI.");
assert(!homeSource.includes("msg.id === 'm10'"), "Chat rendering must not branch on a mock message id.");
assert(!homeSource.includes("onQuote?: (text: string, source: string) => void"), "ChatMessage should not keep unused quote props.");

assert(!signaturePanelSource.includes("const expanded = false"), "Similar cases should not keep unreachable expanded state.");
assert(!signaturePanelSource.includes("{expanded &&"), "Similar cases should not keep unreachable expanded detail markup.");
assert(!signaturePanelSource.includes("onQuoteToChat?: (text: string, source: string) => void"), "Signature panel should not keep unused quote props.");
assert(
  signaturePanelSource.includes("CaseDetailView data={buildCaseDetailFromKnowledgeCase(kc)}"),
  "Similar case detail modal must remain available after slimming.",
);

console.log("RF-FIP product slimming smoke passed.");
