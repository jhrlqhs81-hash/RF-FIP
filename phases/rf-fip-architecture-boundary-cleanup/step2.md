## 읽어야 할 파일
- `docs/ARCHITECTURE.md`
- `docs/TEST_PLAN.md`
- `phases/index.json`
- `phases/rf-fip-architecture-boundary-cleanup/index.json`

## 작업
Record the architecture boundary cleanup and add a regression smoke for the extracted Import analyzer.

## Scope
- Add `smoke:architecture-boundary`.
- Update architecture and test documentation.
- Register the HARNESS phase.

## Acceptance Criteria
- The smoke check proves `Home.tsx` does not own Import candidate domain logic.
- The smoke check proves the extracted analyzer still creates candidates and duplicate matches.
- HARNESS policy includes the new phase without missing records.

## 검증 절차
- `node scripts/rf-fip-architecture-boundary-smoke.mjs`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Do not claim browser E2E completion unless Browser control actually succeeds.
- Keep the phase limited to Import candidate architecture boundaries.

## Verdict
PASS_WITH_RISK
