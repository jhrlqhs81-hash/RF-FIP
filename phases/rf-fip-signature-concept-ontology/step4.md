# Step 4: verification-and-record

## 읽어야 할 파일

- `docs/TEST_PLAN.md`
- `docs/REGRESSION_CHECKLIST.md`
- `phases/rf-fip-signature-concept-ontology/index.json`
- `scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `package.json`

## 작업

Add and run verification for the concept ontology slice, then record the phase status.

## Scope

- Add `smoke:signature-concepts`.
- Run concept, alias, weight, evidence, typecheck/build, harness, and whitespace checks.
- Record final phase verdict.

## Acceptance Criteria

- Concept ontology smoke passes.
- Alias resolver smoke passes.
- Signature weight smoke passes.
- Evidence packet smoke passes.
- TypeScript check and Vite build pass.
- Harness policy check passes.
- `git diff --check` passes.

## 검증 절차

- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `node scripts/rf-fip-signature-alias-resolver-smoke.mjs`
- `node scripts/rf-fip-signature-weights-smoke.mjs`
- `node scripts/rf-fip-evidence-packet-smoke.mjs`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`
- `.\node_modules\.bin\vite.cmd build --config .\vite.config.ts`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not run live OpenAI/Gauss checks for this phase.
- Do not use the real user DB for smoke checks.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: local smoke and build checks.
- Risk: No browser test was run because no UI changed.
