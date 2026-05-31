# Step 1: rag-maintenance-smoke

## 읽어야 할 파일

- `docs/RAG_CONTRACT.md`
- `docs/TEST_PLAN.md`
- `docs/rf-wiki/`
- `server/rfFipRag.ts`
- `scripts/rf-fip-rag-maintenance-smoke.mjs`

## 작업

Add maintenance checks for RAG document metadata, review freshness, provider safety, and deterministic golden query retrieval.

## Scope

- Add owner/review metadata to local public RF Wiki seed documents.
- Expose maintenance metadata on retrieved snippets.
- Add a smoke script for RAG metadata and golden query regression.
- Register the smoke in `package.json` and project test docs.

## Acceptance Criteria

- Every local RF Wiki seed document has stable id, owner, version, updatedAt, and reviewDue metadata.
- Review dates must not be stale.
- OpenAI retrieval must only return public-safe snippets.
- Golden queries must retrieve the expected RF Wiki source ids.
- RAG remains disabled for tasks outside `chat-reply` and `rca-summary`.

## 검증 절차

- `node scripts/rf-fip-rag-maintenance-smoke.mjs`
- `node scripts/rf-fip-rag-contract-smoke.mjs`
- `node scripts/harness-policy-check.mjs`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`

## 금지사항

- Do not add external vector DB or network dependency.
- Do not expose internal or restricted wiki material to OpenAI.
- Do not implement real Gauss Wiki connector before the internal contract exists.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: RAG maintenance smoke, RAG contract smoke, TypeScript check, and Harness policy check passed.
- Residual risk: golden queries cover the current seed wiki only; expand them when internal Wiki/Gauss sources are added.
