# RAG Operations

RF-FIP RAG is reference-only. Operations checks verify source hygiene and provider filtering; they do not approve new root-cause logic.

## Routine Check

In the app, open the Signature Dictionary workspace and click `RAG 점검 실행`. The UI calls `GET /api/rag/ops-report` and displays the latest report without changing data.

Run:

```powershell
node .\scripts\rf-fip-rag-ops-report.mjs
node .\scripts\rf-fip-rag-maintenance-smoke.mjs
node .\scripts\rf-fip-rag-contract-smoke.mjs
node .\scripts\rf-fip-knowledge-case-rag-smoke.mjs
```

Use JSON output for CI or scheduled jobs:

```powershell
node .\scripts\rf-fip-rag-ops-report.mjs --json
```

## Verdicts

- `PASS`: source counts, metadata, review dates, and provider filtering are healthy.
- `WARN`: no leak or stale source, but maintenance is due soon or retrieval quality may be weak.
- `FAIL`: stale public RF Wiki review, duplicate ids, OpenAI leak, invalid Knowledge case excerpt policy, or too few public Wiki documents.

`--fail-on-warn` can be used by stricter release gates.

## RAG Source Rules

- Public RF Wiki documents must remain `public-safe` and OpenAI-eligible only when reviewed.
- Knowledge DB RAG uses server-generated excerpts from persisted `confirmed` cases only.
- Knowledge case excerpts remain `internal-only` and local/Gauss-only by default.
- OpenAI must not receive `knowledge-case-excerpt` snippets unless a future public-safe promotion policy is implemented.
- Vector DB or external search is still unnecessary until deterministic retrieval shows measured recall failures.

## Remaining Automation

- Wire `rag:ops-report` or `GET /api/rag/ops-report` into CI or a scheduler when the deployment environment is fixed.
- Add a Knowledge DB quality report that checks confirmed case completeness and duplicate risk.
- Add production-input review so new Korean shorthand becomes approved alias or golden corpus case, not ad hoc code.
