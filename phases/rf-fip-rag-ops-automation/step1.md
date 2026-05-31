# Step 1: rag-ops-report-and-runbook

## 읽어야 할 파일

- `docs/RAG_CONTRACT.md`
- `docs/RAG_OPERATIONS.md`
- `docs/TEST_PLAN.md`
- `server/rfFipRag.ts`
- `scripts/rf-fip-rag-ops-report.mjs`
- `scripts/rf-fip-rag-maintenance-smoke.mjs`
- `scripts/rf-fip-knowledge-case-rag-smoke.mjs`

## 작업

Add an operational RAG report that can be run manually, by CI, or by a scheduler.

## Scope

- Report public RF Wiki document count and review due status.
- Report Knowledge case excerpt count and policy violations.
- Probe OpenAI retrieval for non-public snippet leakage.
- Emit PASS/WARN/FAIL and optional JSON output.
- Document routine execution and remaining automation.

## Acceptance Criteria

- `rag:ops-report` runs without requiring external services.
- Public RF Wiki count below 20 is a failure.
- Stale `reviewDue` is a failure; near-due review is a warning.
- Knowledge case excerpts must be `internal-only`, `confirmed`, and local/Gauss-only.
- OpenAI retrieval must not include `knowledge-case-excerpt` or non-public snippets.
- The runbook explains routine commands and remaining automation.

## 검증 절차

- `node scripts/rf-fip-rag-ops-report.mjs`
- `node scripts/rf-fip-rag-ops-report.mjs --json`
- `node scripts/rf-fip-rag-maintenance-smoke.mjs`
- `node scripts/rf-fip-knowledge-case-rag-smoke.mjs`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not add vector DB, external search, or network dependency.
- Do not send Knowledge DB excerpts to OpenAI.
- Do not create OS scheduler configuration without an explicit deployment target.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: RAG ops report, JSON report, maintenance smoke, Knowledge case RAG smoke, Harness policy, and whitespace checks passed.
- Residual risk: the script is scheduler-ready, but actual CI/cron/Codex automation wiring still depends on the deployment environment decision.
