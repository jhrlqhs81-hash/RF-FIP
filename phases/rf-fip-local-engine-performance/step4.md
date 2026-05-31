# Step 4: verification

## 읽어야 할 파일

- `docs/README.md`
- `docs/TEST_PLAN.md`
- `docs/REGRESSION_CHECKLIST.md`
- `scripts/rf-fip-local-engine-performance-smoke.mjs`
- `scripts/harness-policy-check.mjs`

## 작업

Run focused smoke and policy checks for local engine performance changes, and record blocked checks separately from passed checks.

## Scope

- Add executable smoke coverage for local engine performance changes.

## Acceptance Criteria

- Alias contract smoke covers approved-only canonicalization.
- Pending alias candidate smoke covers near-match preservation.
- Similarity smoke covers alias-aware key/value matching.

## 검증 절차

- `node scripts/rf-fip-local-engine-performance-smoke.mjs`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not mark TypeScript/build verification as passed if node_modules access is blocked.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: local engine performance smoke, evidence packet smoke, TypeScript check, Vite build, server bundle, Harness policy check, and whitespace checks passed after escalation was available.
- Note: Earlier sandbox `EPERM` and usage-limit blocking were superseded by the later successful verification run.
