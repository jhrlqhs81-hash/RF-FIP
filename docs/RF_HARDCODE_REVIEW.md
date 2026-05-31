# RF Hardcode Review

Last reviewed: 2026-05-28

이 문서는 RF-FIP의 RF 조건, keyword, taxonomy, weight, parser heuristic 중 무엇을 코드에 남기고 무엇을 registry/config로 모아야 하는지 정리합니다.

## Verdict

Verdict: PASS_WITH_RISK

RF-FIP Local Engine은 deterministic해야 하므로 기준선 RF rule은 코드에 남길 수 있습니다. 다만 같은 조건이 client intent, client local extraction, server local fallback, similarity scoring에 중복되면 회귀 위험이 커집니다. 공통으로 쓰는 keyword/regex는 `shared/rfFipRuleCatalog.ts`에 모으고, 운영자가 조정하는 weight와 synonym은 기존 persisted rule/dictionary로 둡니다.

## Keep As Code

- API task enum and provider safety rules
- High-level RF taxonomy groups
- Default signature weight baseline
- Local Engine fallback rules that must work offline
- Parser structural heuristics for CSV/JSON/XLSX splitting

## Move Or Consolidate

| Item | Previous risk | Current direction |
| --- | --- | --- |
| RF intent terms | `Home.tsx`만 별도 regex를 사용해 일반 질문 오분류 위험 | `hasRfAnalysisIntent()` in shared catalog |
| Core signature extraction | client/server fallback이 다른 regex를 사용 | `extractCoreRfSignatures()` in shared catalog |
| Local fallback classification | server-only regex가 client Local Engine과 달라질 수 있음 | `classifyCoreRfTriage()` in shared catalog |
| Signature synonyms | extraction/search/prompt가 서로 다른 동의어를 쓸 수 있음 | `SignatureConceptRegistry`, persisted alias overlay, and alias resolver |
| Similarity value normalization | legacy regex와 concept 비교가 공존 | concept-aware comparison first; legacy fallback remains |

## Remaining Hardcoded Areas

- `rfDesenseTaxonomy.ts` still has classification regex for nuanced domain classification.
- Default Knowledge seed cases live in `knowledgeSeedCases.ts`; `similarCasesDb.ts` no longer searches implicit seed data.
- `signatureWeights.ts` keeps default weight rules in code, with persisted override support.
- `importParser.ts` keeps field/header heuristics for file parsing through `DEFAULT_IMPORT_PARSER_PROFILE`.

These are acceptable short term. The next consolidation should move taxonomy classification from raw regex toward concept ids and relation hints.

## Verification

```powershell
node scripts/rf-fip-hardcode-consolidation-smoke.mjs
node scripts/rf-fip-signature-concept-ontology-smoke.mjs
node scripts/rf-fip-signature-alias-resolver-smoke.mjs
node scripts/rf-fip-llm-adapter-smoke.mjs
node scripts/harness-policy-check.mjs
git diff --check
```

## 2nd Cleanup Result

- `classifyDesenseCase()` now uses shared RF triage as the first classification baseline, then applies concept-aware signature checks and legacy text fallback for richer `DesenseCaseInsight` output.
- `similarCasesDb.ts` no longer owns a second RF key-weight table for retrieval; it uses `signatureWeights.ts` through `getSignatureGroupWeight()`.
- Similarity value matching now relies on `signatureConceptRegistry.ts` concept comparison instead of a local regex value-normalization list.
- Seed Knowledge DB cases are now separated into `knowledgeSeedCases.ts`; runtime search uses caller-supplied Knowledge cases.
- Additional verification: `node scripts/rf-fip-classification-similarity-cleanup-smoke.mjs`

## 3rd Cleanup Result

- Home no longer keeps a second RAW/CSV/JSON parser path; Import candidate generation starts from `readImportFile()`.
- `DEFAULT_IMPORT_PARSER_PROFILE` centralizes case header, title header, and text boundary heuristics.
- `findSimilarCases()` returns no result unless the caller supplies Knowledge cases, so Chat/Similar/Import use the same app state instead of hidden module data.
- Additional verification: `node scripts/rf-fip-data-parser-ownership-smoke.mjs`

## 4th Cleanup Result

- Built-in synonym coverage now includes broader RF/mechanical/test/symptom terms.
- User-approved aliases are persisted through `/api/signature-aliases` and merged as an approved overlay.
- Pending/imported aliases remain candidates only and do not automatically canonicalize.
- Additional verification: `node scripts/rf-fip-signature-alias-dictionary-smoke.mjs`

## 5th Cleanup Result

- Shared RF intent, extraction, and local fallback classification rules were cleaned to use readable Korean/English terms.
- Added a golden corpus smoke for Korean, English, abbreviation, BackGlass, conducted/OTA split, internal noise, and CA/PIM cases.
- Fixed CA + IM/PIM rule priority so a later generic CA rule cannot downgrade an already detected `TX-induced PIM Desense`.
- Additional verification: `node scripts/rf-fip-local-engine-golden-corpus-smoke.mjs`
