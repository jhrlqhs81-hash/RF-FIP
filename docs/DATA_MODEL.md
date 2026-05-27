# Data Model

## Issue

- `id`: stable issue id, e.g. `ISS-2026-001`
- `title`, `model`, `band`
- `status`: `new | hypothesis | validated | confirmed | archived`
- `messages`: chat timeline
- `signatures`: extracted RF tags
- `hypotheses`: RCA candidate reasoning
- `chatSummary`: optional structured summary

## KnowledgeCase

- `id`, `title`, `model`, `band`, `status`
- `confirmedRootCause`
- `mitigation`
- `diagnosticTests`, `suspectedStructures`
- `decisionRationale`
- `usedMaterials`
- `signatures`

## SignatureTag

- `key`
- `value`
- `isNew?`

## SignatureWeightRule

- `id`
- `signatureKey`
- `analysisWeight`: 0-5, classification/hypothesis/RCA importance
- `retrievalWeight`: 0-5, Knowledge DB similarity and reuse importance
- `workflowWeight`: 0-5, missing checklist, next-step, and LLM context priority
- `enabled`
- `reason`
- `operationRule`
- `updatedAt`

## ImportCandidate

- `id`, `fileName`, `status`, `score`
- `reasons`, `evidenceSnippets`
- `previewText`
- `rawText`
- `caseData`
- `materials`

## ImportResult

- `id`, `createdAt`
- `sourceFileNames`
- `approvedCaseIds`
- `skippedDuplicateCaseIds`
- `heldCount`, `candidateCount`

## Storage

- Runtime store is SQLite at `.rf-fip-db/rf-fip.sqlite` or `RF_FIP_DB_DIR/rf-fip.sqlite`.
- Collections are persisted as JSON payload rows for `issues`, `knowledgeCases`, `signatureDictionary`, `signatureWeightRules`, and `importResults`.
- A legacy `.rf-fip-db/rf-fip.json` file may be migrated once when the SQLite store is empty.
