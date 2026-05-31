## 읽어야 할 파일
- `docs/RAG_CONTRACT.md`
- `server/rfFipRag.ts`
- `server/rfFipLlmAdapter.ts`
- `docs/rf-wiki/`

## 작업
Implement server-owned RAG retrieval and inject provider-filtered context into selected LLM tasks.

## Scope
- Add `server/rfFipRag.ts`.
- Retrieve local public markdown snippets with concept/signature/keyword matching.
- Filter snippets by provider and security class.
- Add Gauss internal Wiki blocked missing-contract reasons.
- Inject `retrievedKnowledgeContext` only for `chat-reply` and `rca-summary`.

## Acceptance Criteria
- OpenAI receives only `public-safe` snippets.
- RAG is reference-only and does not create measurements, pass/fail results, root cause, or evidence ids.
- `import-classify`, `signature-normalize`, and `attachment-analysis` do not use RAG in this slice.
- Gauss internal Wiki remains blocked outside the internal environment.

## 검증 절차
- `node scripts/rf-fip-rag-contract-smoke.mjs`
- `node scripts/rf-fip-llm-prompt-contract-smoke.mjs`
- `tsc --noEmit`

## 금지사항
- Do not add client-side Wiki/vector DB calls.
- Do not add vector DB or external dependency in this slice.
- Do not change public LLM API response shape except optional source ids inside result payloads.

## Verdict
PASS

## Verification Note
- Implementation was applied and verified.
- Passed: `node scripts/rf-fip-rag-contract-smoke.mjs`.
- Passed: `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`.
