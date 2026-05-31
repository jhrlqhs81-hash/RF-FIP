# Step 1: manual-rag-ops-check-ui

## 읽어야 할 파일

- `docs/RAG_CONTRACT.md`
- `docs/RAG_OPERATIONS.md`
- `docs/API_CONTRACTS.md`
- `docs/TEST_PLAN.md`
- `server/rfFipRagOps.ts`
- `server/rfFipApi.ts`
- `client/src/lib/rfFipApi.ts`
- `client/src/pages/Home.tsx`
- `scripts/rf-fip-rag-ops-report.mjs`
- `scripts/rf-fip-rag-ops-api-smoke.mjs`

## 작업

Expose the RAG operations check through a read-only API and a user-triggered UI panel.

## Scope

- Move RAG report generation into a server module.
- Keep CLI report and server API on the same implementation.
- Add `GET /api/rag/ops-report`.
- Add a Signature Dictionary workspace panel with a `RAG 점검 실행` button.
- Display verdict, counts, warnings, errors, and next actions.

## Acceptance Criteria

- UI never executes scripts directly.
- API is read-only and does not mutate Knowledge DB, RF Wiki, Signature Dictionary, or Issues.
- User click is required before running the report.
- PASS/WARN/FAIL are visible in the UI.
- API failure shows a clear unavailable message.
- Secrets, raw attachment URLs, and internal metadata are not exposed.

## 검증 절차

- `node scripts/rf-fip-rag-ops-api-smoke.mjs`
- `node scripts/rf-fip-rag-ops-report.mjs`
- `node scripts/rf-fip-rag-ops-report.mjs --json`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`
- `.\node_modules\.bin\vite.cmd build --config .\vite.config.ts`
- `.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not add history persistence in this step.
- Do not add cron, CI, or Codex automation wiring in this step.
- Do not send Knowledge DB excerpts to OpenAI.
- Do not expose API keys or secret values.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: API smoke, CLI report, JSON report, TypeScript, Vite build, server bundle, Harness policy, and whitespace checks passed.
- Residual risk: browser click-through may remain environment-dependent; scheduled execution and report history are separate future phases.
