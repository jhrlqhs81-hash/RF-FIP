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

- Status: blocked
- Verdict: NOT_VERIFIED
- Evidence run: `git diff --check`, `node scripts/harness-policy-check.mjs`
- Evidence blocked: `tsc --noEmit`, Vite build, `rf-fip-local-engine-performance-smoke.mjs`
- Blocker: Codex usage-limit gate rejected required node_modules escalation.
