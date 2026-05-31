# Step 1: hardcode-inventory

## 읽어야 할 파일

- `docs/README.md`
- `docs/RF_HARDCODE_REVIEW.md`
- `docs/REGRESSION_CHECKLIST.md`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/lib/rfDesenseTaxonomy.ts`
- `server/rfFipLlmAdapter.ts`

## 작업

Inventory RF-related hardcoded lists and classify them as acceptable baseline rules or consolidation targets.

## Acceptance Criteria

- Review document lists acceptable hardcoding, risky duplication, and remaining hardcoded areas.
- No runtime behavior changes in this step.

## 검증 절차

- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not change runtime behavior in inventory step.
- Do not remove deterministic fallback rules without replacement.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Risk: Some hardcoded taxonomy regex remains intentionally for future consolidation.
