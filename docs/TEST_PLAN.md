# Test Plan

## Standard Checks

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
```

## Smoke Checks

- `/api/health`
- `/api/issues` POST/GET
- `/api/knowledge-cases` POST/GET
- `/api/signature-dictionary` PUT/GET
- `/api/import-results` POST/GET

Smoke checks must use `RF_FIP_DB_DIR=.rf-fip-db/smoke-*`.

## UI Checks

- Issue create modal opens and saves.
- Import original view opens from candidate detail.
- Knowledge DB detail shows used materials.
- Signature Dictionary filters Knowledge DB.

## Harness Checks

```powershell
node .\scripts\harness-policy-check.mjs
```
