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
- Collections are persisted as JSON payload rows for `issues`, `knowledgeCases`, `signatureDictionary`, and `importResults`.
- A legacy `.rf-fip-db/rf-fip.json` file may be migrated once when the SQLite store is empty.
