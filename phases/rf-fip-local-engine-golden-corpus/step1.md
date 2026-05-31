# Step 1: korean-english-rf-golden-corpus

## 읽어야 할 파일

- `docs/AI_ROLE_CHECKLIST.md`
- `docs/RF_HARDCODE_REVIEW.md`
- `docs/TEST_PLAN.md`
- `shared/rfFipRuleCatalog.ts`
- `client/src/lib/rfDesenseTaxonomy.ts`
- `client/src/lib/localRfAnalyzer.ts`
- `scripts/rf-fip-local-engine-golden-corpus-smoke.mjs`

## 작업

Improve Local Engine deterministic RF extraction and classification for Korean, English, and abbreviation-heavy user input.

## Scope

- Clean shared RF intent, signature extraction, and local fallback classification rules.
- Keep Local Engine as source of truth for evidence packet generation.
- Add golden corpus coverage for Korean RF terms, BackGlass aliases, conducted/OTA split, internal noise, and CA/PIM inputs.
- Fix rule priority when specific PIM evidence and generic CA evidence both exist.

## Acceptance Criteria

- General Korean chat is not classified as RF intent.
- Korean RF text such as `송신`, `감도저하`, `백글라스`, and `가압` extracts expected signatures.
- English/abbreviation forms such as `BackGlass`, `PMIC DCDC`, `MIPI`, `conducted`, `OTA TIS fail`, and `B3+B7 CA IM3` extract expected signatures.
- CA + IM/PIM input remains `TX-induced PIM Desense` and is not downgraded by a generic CA rule.
- Existing evidence packet, hardcode consolidation, and Local Engine performance smokes continue to pass.

## 검증 절차

- `node scripts/rf-fip-local-engine-golden-corpus-smoke.mjs`
- `node scripts/rf-fip-hardcode-consolidation-smoke.mjs`
- `node scripts/rf-fip-evidence-packet-smoke.mjs`
- `node scripts/rf-fip-local-engine-performance-smoke.mjs`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`
- `.\node_modules\.bin\vite.cmd build --config .\vite.config.ts`
- `.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not add KoNLPy, Transformers, LangChain, vector DB, or external NLP dependencies in this step.
- Do not move final root cause ownership from Local Engine to LLM.
- Do not let LLM create measurements, evidence ids, or DB writes.
- Do not broaden UI scope.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: Local Engine golden corpus, hardcode consolidation, evidence packet, Local Engine performance, TypeScript, Vite build, server bundle, Harness policy, and whitespace checks passed.
- Residual risk: golden corpus is still curated and finite; future production logs should be reviewed to add more Korean shorthand and model-specific wording after approval.
