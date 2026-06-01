# Test Plan

## Standard Checks

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
```

## Smoke Checks

- `/api/health`
- `/api/issues` POST/GET
- `/api/knowledge-cases` POST/GET
- `/api/signature-dictionary` PUT/GET
- `/api/signature-aliases` PUT/GET
- `/api/signature-weight-rules` PUT/GET
- `/api/import-results` POST/GET
- Signature concept ontology: approved aliases, relation-driven missing info, concept-aware similarity
- Signature hierarchy: key aliases resolve to concept ids, values simplify to value ids, and weight/context/similarity use concept metadata
- Signature alias dictionary: built-in aliases plus approved persisted overlay, with pending entries and non-synonym relations excluded from automatic canonicalization
- RF hardcode consolidation: shared intent, shared core extraction, client/server local fallback parity
- Local Engine reply: chat reply output must stay aligned with the single generated evidence packet
- Local Engine golden corpus: Korean/English/abbreviation RF inputs extract expected signatures and retain rule priority for BackGlass, conducted/OTA, internal noise, and CA/PIM cases
- Classification/similarity cleanup: taxonomy uses shared triage baseline, Knowledge DB similarity uses analysis signatures plus Signature weight rules, and Band mismatch remains visible with a penalty/badge instead of hard exclusion
- Signature mapping audit: RAT/Band/Degradation/Unit Scope/Tx Threshold classify as metadata, Mechanism/Desense Category/PIM Risk classify as RCA attributes, and only analysis-signature mapping gaps require review
- Data/parser ownership cleanup: similarity requires caller-supplied Knowledge cases, seed data lives in `knowledgeSeedCases.ts`, and Import parser profile owns field/header heuristics
- Product slimming: chat rendering has no mock-id demo table, Similar Case detail modal remains, and unreachable inline expanded detail is removed
- Architecture boundary: Import candidate domain logic lives in `importCandidateAnalyzer.ts`, while `Home.tsx` only orchestrates Import file selection and state updates
- RAG contract: local public wiki snippets are provider/security filtered, applied only to `chat-reply` and `rca-summary`, and Gauss internal wiki remains blocked without its contract
- RAG alias expansion: persisted approved alias/relation entries may expand query terms for retrieval only; pending/reject entries do not expand, and OpenAI filtering remains public-safe
- RAG maintenance: at least 20 public-safe RF Wiki documents exist, metadata is complete, review dates are fresh against the execution date, and golden queries retrieve expected public-safe snippets
- Knowledge DB RAG: persisted `confirmed` cases generate internal-only excerpts for local/Gauss retrieval, `validated` cases are excluded, OpenAI receives only public-safe RF Wiki snippets, and local LLM output reports `usedKnowledgeCaseSourceIds`
- RAG ops report: source counts, confirmed-case to excerpt parity, review due status, Knowledge case excerpt policy, and OpenAI non-public leak checks produce PASS/WARN/FAIL for CI or scheduled execution
- RAG ops UI/API: `/api/rag/ops-report` is read-only, returns the same report contract as the CLI, and the Signature Dictionary workspace can run it on user click

Smoke checks must use `RF_FIP_DB_DIR=.rf-fip-db/smoke-*`.

## UI Checks

- Issue create modal opens and saves.
- Import original view opens from candidate detail.
- Knowledge DB detail shows used materials.
- Signature Dictionary filters Knowledge DB.
- Signature tab can edit Signature weight rules and weighted similarity/missing checklist behavior remains stable.
- Signature tab and Knowledge DB detail split tags into `분석 Signature`, `메타데이터`, and `RCA 속성`; metadata/RCA attributes do not show as unmapped analysis warnings.
- Data/parser ownership cleanup browser retry: Issue create, Chat send, Similar cases, Knowledge DB, and Import original modal must be click-checked when Browser control is available.

## Harness Checks

```powershell
node .\scripts\harness-policy-check.mjs
```
