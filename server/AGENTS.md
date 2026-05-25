# Server Agent

Read `./rules.md` before editing server code.

## Scope

Server-owned API routing and persistence live here.

## Required Docs

- `../docs/API_CONTRACTS.md`
- `../docs/DATA_MODEL.md`
- `../docs/ARCHITECTURE.md`

## Defaults

- Keep API response shapes stable.
- Keep secrets and external provider calls server-only.
- Add smoke coverage for persistence changes.
