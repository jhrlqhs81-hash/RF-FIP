# Step 1: taxonomy-shared-triage

## 읽어야 할 파일

- `docs/README.md`
- `docs/RF_HARDCODE_REVIEW.md`
- `docs/AI_ROLE_CHECKLIST.md`
- `shared/rfFipRuleCatalog.ts`
- `client/src/lib/rfDesenseTaxonomy.ts`

## 작업

Use shared RF triage and concept-aware signature checks as the baseline for `classifyDesenseCase()`.

## Scope

- Keep the existing `DesenseCaseInsight` output contract.
- Prefer shared triage category/tests before legacy text fallback.
- Use concept/key normalized signature checks for known signals.

## Acceptance Criteria

- Explicit `Desense Category` and `Mechanism` signatures still override inferred values.
- PMIC/DCDC input classifies as `Internal Desense / Spurious`.
- PIM/contact/IM signatures classify as `TX-induced PIM Desense`.
- Shared triage diagnostic tests remain in the returned insight.

## 검증 절차

- `node _analysis_rf_platform_ux\scripts\rf-fip-classification-similarity-cleanup-smoke.mjs`
- TypeScript and build checks in Step 3.

## 금지사항

- Do not change UI wording contracts in this step.
- Do not add external NLP dependencies.
- Do not remove legacy fallback text clues until replacement coverage exists.

## Verdict

PASS.
