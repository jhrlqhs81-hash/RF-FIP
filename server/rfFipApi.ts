import type { IncomingMessage, ServerResponse } from "node:http";
import { GaussBlockedError, runRfFipLlm, type LlmTask } from "./rfFipLlmAdapter";
import {
  getRfFipDbSnapshot,
  getRfFipStorageInfo,
  replaceIssues,
  replaceKnowledgeCases,
  replaceSignatureDictionary,
  saveImportResult,
  saveIssue,
  saveKnowledgeCase,
} from "./rfFipStore";

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 2_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function bodyItems(payload: unknown): unknown[] {
  if (payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: unknown[] }).items;
  }
  return [];
}

function isLlmTask(value: string): value is LlmTask {
  return ["chat-reply", "import-classify", "rca-summary", "signature-normalize", "attachment-analysis"].includes(value);
}

export async function handleRfFipApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) return false;

  try {
    if (pathname === "/api/health" && method === "GET") {
      sendJson(res, 200, { ok: true, storage: getRfFipStorageInfo() });
      return true;
    }

    if (pathname.startsWith("/api/llm/") && method === "POST") {
      const task = pathname.split("/").pop() ?? "";
      if (!isLlmTask(task)) {
        sendJson(res, 404, { error: "Unknown RF-FIP LLM task" });
        return true;
      }
      const payload = await readJsonBody(req);
      try {
        sendJson(res, 200, await runRfFipLlm({ ...(payload as object), task }));
      } catch (error) {
        if (error instanceof GaussBlockedError) {
          sendJson(res, error.status, {
            error: error.message,
            provider: "gauss",
            blocked: true,
            missing: error.missing,
          });
          return true;
        }
        throw error;
      }
      return true;
    }

    if (pathname === "/api/issues" && method === "GET") {
      sendJson(res, 200, { items: getRfFipDbSnapshot().issues });
      return true;
    }

    if (pathname === "/api/issues" && method === "POST") {
      const payload = await readJsonBody(req);
      sendJson(res, 200, { item: saveIssue(payload as never) });
      return true;
    }

    if (pathname === "/api/issues" && method === "PUT") {
      const payload = await readJsonBody(req);
      sendJson(res, 200, { items: replaceIssues(bodyItems(payload) as never[]) });
      return true;
    }

    if (pathname === "/api/knowledge-cases" && method === "GET") {
      sendJson(res, 200, { items: getRfFipDbSnapshot().knowledgeCases });
      return true;
    }

    if (pathname === "/api/knowledge-cases" && method === "POST") {
      const payload = await readJsonBody(req);
      sendJson(res, 200, { item: saveKnowledgeCase(payload as never) });
      return true;
    }

    if (pathname === "/api/knowledge-cases" && method === "PUT") {
      const payload = await readJsonBody(req);
      sendJson(res, 200, { items: replaceKnowledgeCases(bodyItems(payload) as never[]) });
      return true;
    }

    if (pathname === "/api/signature-dictionary" && method === "GET") {
      sendJson(res, 200, { items: getRfFipDbSnapshot().signatureDictionary });
      return true;
    }

    if (pathname === "/api/signature-dictionary" && method === "PUT") {
      const payload = await readJsonBody(req);
      sendJson(res, 200, { items: replaceSignatureDictionary(bodyItems(payload) as never[]) });
      return true;
    }

    if (pathname === "/api/import-results" && method === "GET") {
      sendJson(res, 200, { items: getRfFipDbSnapshot().importResults });
      return true;
    }

    if (pathname === "/api/import-results" && method === "POST") {
      const payload = await readJsonBody(req);
      sendJson(res, 200, { item: saveImportResult(payload as never) });
      return true;
    }

    sendJson(res, 404, { error: "Unknown RF-FIP API route" });
    return true;
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    return true;
  }
}
