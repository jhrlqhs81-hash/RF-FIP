# Server Rules

- Do not change `/api/*` response shape without updating `docs/API_CONTRACTS.md`.
- Do not write runtime DB files outside `RF_FIP_DB_DIR` or `.rf-fip-db/`.
- Do not expose API keys or provider secrets in responses.
- Storage backend swaps must preserve `client/src/lib/rfFipApi.ts` contracts.
- Smoke tests must use a `.rf-fip-db/smoke-*` path.
- SQLite storage uses `node:sqlite` and keeps collection payloads as JSON rows unless a later migration introduces normalized tables.
