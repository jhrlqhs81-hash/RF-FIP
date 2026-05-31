# Step 1: public-rf-wiki-expansion-and-golden-queries

## 읽어야 할 파일

- `docs/RAG_CONTRACT.md`
- `docs/TEST_PLAN.md`
- `docs/rf-wiki/`
- `scripts/rf-fip-rag-maintenance-smoke.mjs`

## 작업

Expand the public-safe RF Wiki corpus and update deterministic RAG maintenance checks.

## Scope

- Add 15 public-safe RF Wiki markdown documents.
- Keep deterministic metadata/signature/concept retrieval.
- Do not add vector DB, BM25 dependency, or external search service.
- Use execution-date based stale review checking.
- Add golden queries for the expanded corpus.

## Acceptance Criteria

- `docs/rf-wiki` contains at least 20 markdown documents.
- Every public RF Wiki document has required metadata.
- Stale `reviewDue` is checked against the actual execution date.
- Golden queries retrieve expected public-safe wiki ids.
- RAG remains reference-only and provider-filtered.

## 검증 절차

- `node scripts/rf-fip-rag-maintenance-smoke.mjs`
- `node scripts/rf-fip-rag-contract-smoke.mjs`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not add internal, restricted, customer, model, project, or operator details to public RF Wiki.
- Do not send non-public snippets to OpenAI.
- Do not implement Knowledge DB RAG or Gauss Wiki connector in this step.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: RAG maintenance smoke, RAG contract smoke, TypeScript check, Harness policy check, and whitespace checks passed.
- Residual risk: public RF Wiki coverage is broader but still deterministic; Knowledge DB case RAG and internal Gauss Wiki remain separate future phases.
