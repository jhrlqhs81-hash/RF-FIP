# Step 1: confirmed-knowledge-case-rag-excerpts

## 읽어야 할 파일

- `docs/RAG_CONTRACT.md`
- `docs/API_CONTRACTS.md`
- `docs/TEST_PLAN.md`
- `server/rfFipRag.ts`
- `server/rfFipLlmAdapter.ts`
- `server/rfFipStore.ts`
- `scripts/rf-fip-knowledge-case-rag-smoke.mjs`

## 작업

Add server-generated Knowledge DB RAG excerpts for persisted confirmed cases.

## Scope

- Generate `knowledge-case-excerpt` sources from persisted server Knowledge cases.
- Include only `status: confirmed` cases.
- Keep excerpts internal-only and local/Gauss eligible.
- Keep OpenAI limited to public-safe RF Wiki snippets.
- Preserve existing public RF Wiki RAG and deterministic retrieval.

## Acceptance Criteria

- Confirmed Knowledge cases can be retrieved by local and Gauss RAG paths.
- Validated Knowledge cases are excluded from RAG excerpts.
- OpenAI receives no internal-only Knowledge case excerpts.
- Excerpts omit raw attachments, URLs, issue threads, users, assignees, and model metadata.
- LLM results can report `usedKnowledgeCaseSourceIds` separately from `usedWikiSourceIds`.
- RAG remains applied only to `chat-reply` and `rca-summary`.

## 검증 절차

- `node scripts/rf-fip-knowledge-case-rag-smoke.mjs`
- `node scripts/rf-fip-rag-contract-smoke.mjs`
- `node scripts/rf-fip-rag-maintenance-smoke.mjs`
- `node scripts/rf-fip-llm-prompt-contract-smoke.mjs`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`
- `node scripts/harness-policy-check.mjs`
- `git diff --check`

## 금지사항

- Do not send internal-only Knowledge DB excerpts to OpenAI.
- Do not treat Knowledge case excerpts as source of truth for new measurements or new root cause claims.
- Do not include raw attachment content, URLs, issue messages, user names, assignees, or model metadata in excerpts.
- Do not add vector DB, BM25 dependency, external search, or public-safe promotion UI in this step.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS_WITH_RISK
- Evidence: Knowledge case RAG smoke, RAG contract smoke, RAG maintenance smoke, LLM prompt contract smoke, TypeScript check, Harness policy check, and whitespace check passed.
- Residual risk: OpenAI public-safe promotion for Knowledge cases and internal Gauss Wiki integration remain separate future phases.
