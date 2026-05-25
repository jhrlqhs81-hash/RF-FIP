# ADR 0002: Harness Setup Status Log

## Status

Active

## 2026-05-25 Update

- Started docs, AGENTS, rules, and hook setup for Harness automation.
- Scope: create `docs/` contracts, local rule imports, and policy check script.
- Risk: keep files concise and avoid mixing runtime logs into docs.

## 2026-05-25 Follow-up

- Added `docs/` contract set, scoped `AGENTS.md` and `rules.md` files, and `scripts/harness-policy-check.mjs`.
- Added `harness:check` package script.
- Policy hook passed: 12 docs and 10 AGENTS files verified.
- Phase step files were updated to reference `docs/` explicitly.

## 2026-05-25 Step 0 Baseline Start

- Started `qa-harness-baseline` as the first AFK Harness slice.
- Scope is limited to verification baseline automation and durable evidence.
- Added an RF-FIP production API smoke script plan that uses only Node built-ins and a `.rf-fip-db/smoke-baseline-*` database directory.

## 2026-05-25 Step 0 Baseline Complete

- Added `scripts/rf-fip-smoke.mjs` and `smoke:rf-fip`.
- Verification passed: Harness policy check, TypeScript compile check, Vite production build, server bundle, and RF-FIP production API smoke.
- Caution recorded: sandbox execution can raise EPERM on `node_modules`; escalated verification passed and should be treated as the valid environment check for this workspace.

## 2026-05-25 Step 1 Browser E2E Blocked

- Temporary production server health passed on `http://127.0.0.1:3322/api/health` with a smoke DB.
- Browser plugin access failed for both `http://127.0.0.1:3322/` and `http://localhost:3322/` with `net::ERR_BLOCKED_BY_CLIENT`.
- Step 1 is recorded as `blocked`; independent non-browser steps will continue because the user explicitly requested continuous execution.

## 2026-05-25 Step 2 Import Parser Complete

- Added dependency-free `.xlsx` sheet row extraction through `client/src/lib/importParser.ts`.
- Import candidates now come from `ParsedImportSource` records with source table materials preserved for original view.
- Parser smoke passed: 3 CSV sources and 2 XLSX sources.
- Typecheck and Vite build passed after fixing `matchAll()` iterator handling.
- Residual risk: legacy `.xls` is still a hold/metadata path until a parser dependency is approved.

## 2026-05-25 Step 3 SQLite Store Complete

- Replaced the JSON file-backed RF-FIP store with `node:sqlite`.
- Default runtime DB is now `rf-fip.sqlite` under `RF_FIP_DB_DIR` or `.rf-fip-db/`.
- API contracts were preserved; `/api/health` now reports SQLite storage metadata.
- SQLite smoke passed restart persistence for issues, knowledge cases, signature dictionary, and import results.

## 2026-05-25 Step 4 Verification Blocked

- Implemented Import workflow hardening changes: duplicate similarity matching, hold candidate promotion, and Import history UI/state.
- Required verification could not run because escalated TypeScript/build execution was rejected by the Codex usage-limit gate.
- Step 4 remains `NOT_VERIFIED`; do not proceed to Step 5 until verification is available or the user explicitly accepts this risk.

## 2026-05-26 Step 4 Verification Complete

- Resumed Step 4 verification.
- Fixed current TypeScript target incompatibility by avoiding direct `Set` iteration in `signatureSimilarity()`.
- Typecheck and Vite production build passed.
- Step 4 is now `PASS_WITH_RISK`; residual risk is browser E2E still blocked by the environment from Step 1.

## 2026-05-26 Step 5 Gauss Adapter Contract Complete

- Completed the offsite-safe Gauss adapter contract.
- Added server-owned `/api/llm/*` route handling, local deterministic provider behavior, and Gauss blocked behavior.
- Verified local deterministic response and Gauss blocked contract with `rf-fip-llm-adapter-smoke.mjs`.
- Real Gauss calls remain intentionally unimplemented until the project is moved to the internal PC/network and official API schema is available.

## 2026-05-26 Step 6 Git Blocked

- Added `docs/GAUSS_INTERNAL_HANDOFF.md` for internal Gauss integration.
- `git status` failed because `_analysis_rf_platform_ux` is not a Git repository.
- Step 6 is blocked until the user chooses either the real repository folder or initializes/connects this folder to a remote.

## 2026-05-26 Theme And Issue List Update

- Added app-level light/dark theme switching and converted key UI surfaces to semantic tokens.
- Added removable controls for left-panel issues that are `validated` or `confirmed`; this changes the Issue list only and preserves Knowledge DB records.
- Verification passed: whitespace diff check and Harness policy check.
- TypeScript verification is pending because sandbox `EPERM` blocked local `tsc`, and escalation was rejected by the Codex usage-limit gate.
