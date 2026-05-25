# Architecture

## Directory Structure

```text
client/src/pages/       # page-level workflow
client/src/components/  # reusable UI components
client/src/lib/         # client helpers and API wrappers
server/                 # Express API and persistence boundary
shared/                 # shared constants/placeholders
docs/                   # product and architecture contracts
phases/                 # Harness phase execution files
```

## Data Flow

```text
User input -> React UI -> client/src/lib/rfFipApi.ts
-> server/rfFipApi.ts -> server/rfFipStore.ts -> .rf-fip-db
-> response -> UI state update
```

## Persistence Boundary

- Client never writes storage directly.
- Server API shape is stable even if JSON store changes to SQLite.
- Runtime DB files stay under `.rf-fip-db/` and are gitignored.

## UI Boundary

- `Home.tsx` owns current page workflow state.
- Shared display logic belongs in `components/`.
- API wrappers belong in `client/src/lib/`.

## Build Boundary

- Vite bundles frontend.
- `esbuild server/index.ts` bundles production server.
- `manualChunks` prevents large single JS bundle regressions.
