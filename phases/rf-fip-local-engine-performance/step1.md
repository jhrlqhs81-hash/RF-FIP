# Step 1: alias-dictionary-contract

## 읽어야 할 파일

- `docs/README.md`
- `docs/RF_DOMAIN_SPEC.md`
- `docs/REGRESSION_CHECKLIST.md`
- `client/src/lib/signatureAliasResolver.ts`

## 작업

Define approved alias metadata and keep automatic canonicalization limited to approved entries.

## Scope

- Strengthen the local alias dictionary contract without adding UI or external NLP dependencies.

## Acceptance Criteria

- Approved aliases are the only aliases used for automatic canonicalization.
- Pending entries can exist in the contract but do not affect canonical signatures.

## 검증 절차

- `node scripts/rf-fip-signature-alias-resolver-smoke.mjs`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not add UI for pending alias review in this step.
- Do not auto-map unapproved near matches.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: code review, `git diff --check`, `harness-policy-check.mjs`
- Risk: TypeScript/build execution was blocked by the Codex usage-limit gate.
