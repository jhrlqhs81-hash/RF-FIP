# LLM/Gauss Contract

## Providers

- `local`: deterministic local fallback
- `openai`: server-owned OpenAI Responses API adapter for offsite trial use
- `gauss`: blocked until API spec is provided

## OpenAI Inputs

- `LLM_PROVIDER=openai`
- `OPENAI_API_KEY` preferred; `open-ai-api-key` is accepted as a compatibility alias for the local `.env`
- optional `OPENAI_MODEL` defaults to `gpt-4.1`
- optional `OPENAI_API_URL` defaults to `https://api.openai.com/v1/responses`
- optional `OPENAI_TIMEOUT_MS` defaults to `30000`

## Required Gauss Inputs

- `GAUSS_API_URL`
- `GAUSS_API_KEY`
- request JSON schema
- response JSON schema
- file upload support
- timeout and error rules

## Target Capabilities

- chat reply
- RAW Import first-pass classification
- RCA Summary enrichment
- Signature extraction/normalization
- attachment text/table/image analysis

## Security Rules

- API keys are server-only.
- Client code never calls Gauss or OpenAI directly.
- Failed Gauss calls must fall back or surface a clear recoverable error.
- Failed OpenAI calls must not expose `OPENAI_API_KEY`.

## Blocked Rule

Do not implement real Gauss calls by guessing schema.

## Server Adapter Contract

- Entry points are server-only under `/api/llm/*`.
- `LLM_PROVIDER=local` returns deterministic local output for smoke and offline use.
- `LLM_PROVIDER=openai` calls the OpenAI Responses API through the server adapter only; if `LLM_PROVIDER` is unset and an OpenAI key is present, OpenAI is used first.
- `LLM_PROVIDER=gauss` returns a 501 blocked response until URL, key, request schema, response schema, file upload support, timeout rules, and error rules are supplied.
- Blocked and failed responses must not include `GAUSS_API_KEY`, `OPENAI_API_KEY`, or any secret value.
