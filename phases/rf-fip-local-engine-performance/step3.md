# Step 3: alias-aware-scoring

## 읽어야 할 파일

- `docs/README.md`
- `docs/RF_DOMAIN_SPEC.md`
- `docs/REGRESSION_CHECKLIST.md`
- `client/src/lib/similarCasesDb.ts`
- `client/src/lib/signatureAliasResolver.ts`

## 작업

Use the shared alias resolver when comparing Knowledge DB signatures and choose the best value match per normalized key.

## Scope

- Improve deterministic Knowledge DB similarity scoring using the shared alias resolver.

## Acceptance Criteria

- Equivalent signature values compare through canonical values.
- Equivalent structure keys compare across Structure, Contact Structure, and Contact Type.
- Multiple target tags with the same normalized key use the best value match.

## 검증 절차

- `node scripts/rf-fip-local-engine-performance-smoke.mjs`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not lower similarity confidence by double-counting duplicate equivalent keys.
- Do not change Knowledge DB deletion or issue-list behavior.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: code review, `git diff --check`, `harness-policy-check.mjs`
- Risk: TypeScript/build execution was blocked by the Codex usage-limit gate.
