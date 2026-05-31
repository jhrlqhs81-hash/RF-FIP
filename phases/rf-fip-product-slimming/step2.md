## 읽어야 할 파일
- `docs/TEST_PLAN.md`
- `phases/index.json`
- `phases/rf-fip-product-slimming/index.json`

## 작업
Record the slimming phase and add a source-level smoke check for removed residue and preserved detail modal behavior.

## Scope
- Add `smoke:product-slimming`.
- Update phase index so the HARNESS policy check includes this phase.
- Add the slimming smoke to the documented smoke checklist.

## Acceptance Criteria
- HARNESS policy check includes this phase without missing step docs.
- Smoke check fails if the removed demo/dead UI returns.
- Verification result is recorded with remaining browser-click risk separated from code checks.

## 검증 절차
- `node scripts/rf-fip-product-slimming-smoke.mjs`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Product slimming beyond low-risk residue removal needs a separate decision because it may remove user-visible workflows.
- Keep `docs/REGRESSION_CHECKLIST.md` as the boundary for required flows.

## Verdict
PASS_WITH_RISK
