# Step 2: similarity-weight-consolidation

## 읽어야 할 파일

- `docs/README.md`
- `docs/SIGNATURE_ONTOLOGY.md`
- `docs/RF_HARDCODE_REVIEW.md`
- `client/src/lib/similarCasesDb.ts`
- `client/src/lib/signatureWeights.ts`
- `client/src/lib/signatureConceptRegistry.ts`

## 작업

Make Knowledge DB similarity use concept-aware value comparison and the managed Signature weight rules as the single retrieval weighting source.

## Scope

- Remove the local RF key-weight copy from similarity scoring.
- Remove legacy regex value normalization from similarity scoring.
- Preserve exact match, partial match, and key-only weak match scoring behavior.

## Acceptance Criteria

- Alias/concept equivalent signatures such as `Structure=BackGlass` and `Contact Structure=Back Glass` still match strongly.
- Exact signature matches still score 100 when no target penalty exists.
- Custom retrieval weights remain accepted through `SignatureWeightRule`.
- No local regex value-normalization list remains in `similarCasesDb.ts`.

## 검증 절차

- `node _analysis_rf_platform_ux\scripts\rf-fip-classification-similarity-cleanup-smoke.mjs`
- Existing Local Engine and concept smokes in Step 3.

## 금지사항

- Do not change seed Knowledge DB case content in this step.
- Do not change the persisted `SignatureTag { key, value }` shape.
- Do not add UI.

## Verdict

PASS.
