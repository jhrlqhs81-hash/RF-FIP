## 읽어야 할 파일
- `docs/SIGNATURE_ONTOLOGY.md`
- `docs/TEST_PLAN.md`
- `phases/index.json`
- `phases/rf-fip-signature-hierarchy-enforcement/index.json`

## 작업
Record hierarchy enforcement and add a regression smoke.

## Scope
- Add `smoke:signature-hierarchy`.
- Update ontology and test docs.
- Register the HARNESS phase.

## Acceptance Criteria
- HARNESS policy includes the phase without missing records.
- Smoke check fails if key aliases stop resolving through concept ids.
- Smoke check fails if LLM weighted context loses concept/value metadata.

## 검증 절차
- `node scripts/rf-fip-signature-hierarchy-smoke.mjs`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Do not claim browser E2E completion unless Browser control actually succeeds.
- Do not change public API shape for signatures.

## Verdict
PASS_WITH_RISK
