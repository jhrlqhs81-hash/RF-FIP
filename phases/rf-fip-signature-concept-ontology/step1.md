# Step 1: ontology-contract

## 읽어야 할 파일

- `docs/README.md`
- `docs/DATA_MODEL.md`
- `docs/AI_ROLE_CHECKLIST.md`
- `docs/SIGNATURE_ONTOLOGY.md`
- `docs/REGRESSION_CHECKLIST.md`

## 작업

Define the Signature concept hierarchy and synonym operating rules without changing persisted `SignatureTag`.

## Scope

- Add documentation for concept id, domain, canonical key, canonical value, approved aliases, and relation rules.
- Keep existing Issue and Knowledge DB signature storage compatible.

## Acceptance Criteria

- `docs/SIGNATURE_ONTOLOGY.md` states goals, non-goals, hierarchy rule, relation types, synonym approval rule, and verification commands.
- `docs/DATA_MODEL.md` documents `SignatureConcept` as an internal Local Engine registry.

## 검증 절차

- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not introduce a DB migration in this step.
- Do not add UI in this step.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: document review, Harness policy check, whitespace check.
