# LLM/Gauss Contract

## Providers

- `local`: deterministic local fallback
- `gauss`: blocked until API spec is provided

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
- Client code never calls Gauss directly.
- Failed Gauss calls must fall back or surface a clear recoverable error.

## Blocked Rule

Do not implement real Gauss calls by guessing schema.

## Server Adapter Contract

- Entry points are server-only under `/api/llm/*`.
- `LLM_PROVIDER=local` returns deterministic local output for smoke and offline use.
- `LLM_PROVIDER=gauss` returns a 501 blocked response until URL, key, request schema, response schema, file upload support, timeout rules, and error rules are supplied.
- Blocked responses must not include `GAUSS_API_KEY` or any secret value.
