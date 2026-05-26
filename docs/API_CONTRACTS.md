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

## API Rules

- Do not expose secrets to client responses.
- Keep response shapes stable across storage backend changes.
- Return clear 4xx JSON errors for invalid payloads.
- OpenAI provider calls must stay server-owned and use the server environment key only. Prefer `OPENAI_API_KEY`; `open-ai-api-key` is accepted as a local `.env` compatibility alias.
- Gauss provider calls must stay server-owned and return 501 blocked until the request/response schema is known.
