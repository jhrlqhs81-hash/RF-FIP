# Step 3: local-engine-integration

## 읽어야 할 파일

- `docs/SIGNATURE_ONTOLOGY.md`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/lib/similarCasesDb.ts`
- `client/src/lib/signatureWeights.ts`

## 작업

Connect concept interpretation to Local Engine outputs while keeping existing public contracts stable.

## Scope

- Add relation hints to `LocalEvidencePacket`.
- Add relation-driven missing checklist items.
- Use concept-aware key/value comparison in Knowledge DB similarity.
- Preserve existing weight rule behavior.

## Acceptance Criteria

- Contact structure signatures add a pressure A/B missing-info requirement.
- `Structure=백글` and `Contact Structure=Back Glass` match strongly in similarity.
- Existing signature weight smoke still passes.

## 검증 절차

- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `node scripts/rf-fip-signature-weights-smoke.mjs`
- `node scripts/rf-fip-evidence-packet-smoke.mjs`

## 금지사항

- Do not rename existing stored signature keys.
- Do not change `/api/*` response shape.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: concept ontology smoke, signature weights smoke, evidence packet smoke.
- Risk: Browser/UI verification is not applicable because this step has no UI change.
