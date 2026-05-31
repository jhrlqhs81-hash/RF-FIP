## 읽어야 할 파일
- `docs/SIGNATURE_ONTOLOGY.md`
- `docs/DATA_MODEL.md`
- `client/src/lib/signatureConceptRegistry.ts`
- `client/src/lib/signatureWeights.ts`
- `client/src/lib/similarCasesDb.ts`
- `client/src/lib/localRfAnalyzer.ts`

## 작업
Enforce Signature hierarchy at runtime while preserving the flat persisted `SignatureTag` contract.

## Scope
- Add key-level concept resolution for aliases such as `Contact Type` and `Structure`.
- Expose `conceptId`, `valueId`, `domain`, and `conceptPath` metadata.
- Make Signature weight lookup concept-aware.
- Include canonical/concept metadata in weighted LLM context.
- Use tag-aware weights in Local Engine evidence and Knowledge DB similarity.

## Acceptance Criteria
- Key aliases resolve to a stable concept id.
- Value aliases resolve to simplified value ids.
- Weight lookup treats concept key aliases consistently.
- Similarity still matches canonicalized key/value aliases strongly.
- Persisted `SignatureTag` shape remains unchanged.

## 검증 절차
- `node scripts/rf-fip-signature-hierarchy-smoke.mjs`
- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `node scripts/rf-fip-signature-weights-smoke.mjs`
- `tsc --noEmit`

## 금지사항
- Do not migrate persisted DB schema in this slice.
- Do not let pending aliases affect canonicalization.
- Do not require a new large admin UI.

## Verdict
PASS
