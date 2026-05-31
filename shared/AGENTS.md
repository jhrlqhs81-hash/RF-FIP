# Shared Agent

Read `./rules.md` before editing shared modules.

## Scope

Cross-runtime TypeScript used by both client and server.

## Defaults

- Keep shared modules deterministic and side-effect free.
- Do not import React, DOM-only APIs, server-only APIs, or app state.
- Preserve client/server bundle compatibility.

## Verification

- Run TypeScript check after changing shared exports.
- Run the narrow smoke that exercises both client and server consumers.
