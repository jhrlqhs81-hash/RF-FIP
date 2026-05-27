# Step 2: pending-alias-preservation

## 읽어야 할 파일

- `docs/README.md`
- `docs/DATA_MODEL.md`
- `docs/LLM_GAUSS_CONTRACT.md`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/pages/Home.tsx`

## 작업

Preserve pending alias candidates in chat, import facts, and shared LLM context without treating them as approved aliases.

## Scope

- Preserve high-similarity unknown alias candidates without auto-mapping them.

## Acceptance Criteria

- Chat messages can retain pending alias candidates.
- Shared LLM context includes pending alias candidates.
- Import local facts include pending alias candidates.

## 검증 절차

- `node scripts/rf-fip-local-engine-performance-smoke.mjs`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not persist pending aliases as approved dictionary entries.
- Do not add new dependencies for Korean tokenization in this step.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: code review, `git diff --check`, `harness-policy-check.mjs`
- Risk: TypeScript/build execution was blocked by the Codex usage-limit gate.
