# ADR 0001: Harness Docs And Local Rules

## Status

Accepted

## Context

RF-FIP remaining work will be automated through Harness phases. Agents need stable product contracts and local rules to prevent drift.

## Decision

- Use `docs/` for product, architecture, API, UI, regression, and test contracts.
- Use local `AGENTS.md` plus same-directory `rules.md` for scoped agent behavior.
- Use `phases/` for executable step plans.
- Keep `AGENTS.md` and `CLAUDE.md` files under 70 lines; split into child scopes when needed.
- Add `scripts/harness-policy-check.mjs` as a hook-style guard.

## Consequences

- Phase generation must reference `docs/`.
- Step failures or warnings should update the nearest `rules.md`.
- Reusable rules live near the code they govern, not in chat logs.
