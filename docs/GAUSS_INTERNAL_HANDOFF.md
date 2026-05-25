# Gauss Internal Handoff Checklist

Use this when the project is moved to the internal PC/network.

## Required Inputs

- `GAUSS_API_URL`
- `GAUSS_API_KEY`
- Request JSON schema for each `/api/llm/*` task
- Response JSON schema for each `/api/llm/*` task
- File upload support contract
- Timeout and error response rules

## Integration Boundary

- Implement real calls only inside `server/rfFipLlmAdapter.ts`.
- Keep client calls on `/api/llm/*`.
- Do not expose `GAUSS_API_KEY` to the client, DB, logs, or API responses.
- Keep `LLM_PROVIDER=local` deterministic for offline smoke checks.

## Verification

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
node .\scripts\rf-fip-llm-adapter-smoke.mjs
```

## Completion Rule

Do not mark real Gauss integration complete until at least one internal-network smoke validates request/response parsing without leaking secrets.
