# Step 3: client-server-consumers

## 읽어야 할 파일

- `client/src/pages/Home.tsx`
- `client/src/lib/localRfAnalyzer.ts`
- `server/rfFipLlmAdapter.ts`
- `shared/rfFipRuleCatalog.ts`
- `docs/RF_HARDCODE_REVIEW.md`

## 작업

Replace duplicated client/server RF keyword logic with the shared rule catalog where behavior must match.

## Acceptance Criteria

- Home RF intent routing uses shared `hasRfAnalysisIntent()`.
- Client Local Engine extraction uses shared `extractCoreRfSignatures()`.
- Server local LLM fallback uses shared extraction and classification.
- Existing signature alias and concept ontology behavior still passes.

## 검증 절차

- `node scripts/rf-fip-hardcode-consolidation-smoke.mjs`
- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `node scripts/rf-fip-signature-alias-resolver-smoke.mjs`
- `node scripts/rf-fip-llm-adapter-smoke.mjs`

## 금지사항

- Do not change `/api/llm/*` response shape.
- Do not move taxonomy classification regex in this step.

## Verdict

- Status: completed
- Verdict: PASS
