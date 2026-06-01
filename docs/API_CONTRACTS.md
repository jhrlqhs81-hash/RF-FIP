# API Contracts

All RF-FIP APIs are server-owned under `/api`.

## Health

- `GET /api/health`
- Response: `{ ok: true, storage: { dbPath: string, engine?: string, migratedFromJson?: boolean } }`

## Issues

- `GET /api/issues`
- `POST /api/issues`
- `PUT /api/issues`
- Shape: `{ items: Issue[] }` or `{ item: Issue }`

## Knowledge Cases

- `GET /api/knowledge-cases`
- `POST /api/knowledge-cases`
- `PUT /api/knowledge-cases`
- Shape: `{ items: KnowledgeCase[] }` or `{ item: KnowledgeCase }`

## Signature Dictionary

- `GET /api/signature-dictionary`
- `PUT /api/signature-dictionary`
- Shape: `{ items: SignatureTag[] }`

## Signature Aliases

- `GET /api/signature-aliases`
- `PUT /api/signature-aliases`
- Shape: `{ items: SignatureAliasEntry[] }`
- Purpose: approved user/import alias overlay for the built-in Signature concept dictionary.
- Rule: only approved aliases may affect automatic canonicalization.
- Optional fields: `aliasType`, `relationType`, `sourceDocId`, `approvedBy`, `note`, `scope`.
- Canonicalizing relation types: `synonym`, `alias`, `abbreviation`, `translation`, `spelling_variant`, `semantic_alias`.
- Non-canonicalizing relation types: `related_to`, `parent_of`, `child_of`, `caused_by`, `measured_by`, `condition_of`, `reject`.

## Signature Weight Rules

- `GET /api/signature-weight-rules`
- `PUT /api/signature-weight-rules`
- Shape: `{ items: SignatureWeightRule[] }`
- Purpose: administrator-managed grouped weights for analysis, retrieval, and workflow use.

## Import Results

- `GET /api/import-results`
- `POST /api/import-results`
- Shape: `{ items: ImportApprovalRecord[] }` or `{ item: ImportApprovalRecord }`

## LLM Adapter

- `POST /api/llm/chat-reply`
- `POST /api/llm/import-classify`
- `POST /api/llm/rca-summary`
- `POST /api/llm/signature-normalize`
- `POST /api/llm/attachment-analysis`
- Local shape: `{ provider: "local", task: string, result: object }`
- OpenAI shape: `{ provider: "openai", task: string, result: object }`
- OpenAI blocked shape until key exists: `{ error: string, provider: "openai", blocked: true, missing: ["OPENAI_API_KEY"] }`
- Gauss blocked shape until API spec exists: `{ error: string, provider: "gauss", blocked: true, missing: string[] }`
- `chat-reply` and `rca-summary` may include server-built `context.retrievedKnowledgeContext` for RAG reference snippets.
- RAG snippets sent to OpenAI must be `securityClass: "public-safe"` and provider-filtered.
- Persisted `confirmed` Knowledge DB cases may be converted to server-owned `knowledge-case-excerpt` RAG snippets for `local` and `gauss`; OpenAI receives none by default.
- LLM task results may include `usedWikiSourceIds?: string[]` for RF Wiki snippets and `usedKnowledgeCaseSourceIds?: string[]` for confirmed Knowledge case excerpts.
- Gauss internal wiki remains blocked until `GAUSS_WIKI_API_URL`, `GAUSS_WIKI_API_KEY`, wiki request schema, wiki response schema, and document security classification rules are supplied.

## RAG Operations

- `GET /api/rag/ops-report`
- Shape: `{ report: RagOpsReport }`
- Purpose: user-triggered operational health check for RAG sources and provider filtering.
- Counts include public RF Wiki documents, persisted `confirmed` Knowledge DB cases, generated Knowledge case excerpts, non-confirmed Knowledge cases excluded from RAG, and OpenAI probe snippets.
- Rule: this endpoint is read-only and must not mutate Knowledge DB, RF Wiki, Signature Dictionary, or Issues.
- Rule: response must not expose API keys, raw attachment URLs, internal user metadata, or secret values.

## API Rules

- Do not expose secrets to client responses.
- Keep response shapes stable across storage backend changes.
- Return clear 4xx JSON errors for invalid payloads.
- OpenAI provider calls must stay server-owned and use the server environment key only. Prefer `OPENAI_API_KEY`; `open-ai-api-key` is accepted as a local `.env` compatibility alias.
- Gauss provider calls must stay server-owned and return 501 blocked until the request/response schema is known.
- RAG retrieval must remain server-owned. Client code must not call wiki or vector DB endpoints directly.
