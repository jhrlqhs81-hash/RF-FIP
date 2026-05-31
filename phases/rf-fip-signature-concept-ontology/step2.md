# Step 2: concept-registry

## 읽어야 할 파일

- `docs/SIGNATURE_ONTOLOGY.md`
- `client/src/lib/signatureConceptRegistry.ts`
- `client/src/lib/signatureAliasResolver.ts`

## 작업

Add the Local Engine concept registry that owns canonical concepts, values, approved aliases, and relation rules.

## Scope

- Add `SignatureConceptRegistry`.
- Provide concept/value comparison helpers.
- Generate approved synonym entries from the concept registry.

## Acceptance Criteria

- Back Glass variants resolve to `mechanical.contact_structure/back_glass`.
- Approved aliases are still the only automatic canonicalization source.
- Relation rules can be read without LLM involvement.

## 검증 절차

- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `node scripts/rf-fip-signature-alias-resolver-smoke.mjs`

## 금지사항

- Do not auto-approve pending aliases.
- Do not allow LLM-created concepts.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: concept ontology smoke and alias resolver smoke.
