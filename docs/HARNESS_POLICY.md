# Harness Policy

## Phase Creation

- Always read `docs/README.md` first.
- Include relevant docs in every `stepN.md` read list.
- Each step must be independently executable.
- Acceptance Criteria must include runnable commands.

## AGENTS and Rules

- Major directories own `AGENTS.md` and `rules.md`.
- `AGENTS.md` must reference same-directory `rules.md`.
- If an `AGENTS.md` or `CLAUDE.md` exceeds 70 lines, split into child directories.

## Rule Freshness

- On step failure, warning, or repeated risk, update the nearest `rules.md`.
- Rules should be short, enforceable, and scoped.
- Do not store raw logs in rules.

## Regression Management

- Every phase must check `REGRESSION_CHECKLIST.md`.
- Hooks may fail fast when required docs, rules, or phase files are missing.
- Do not mark a step completed when verification is blocked.

## Git Safety

- Do not stage, commit, push, or init a repo without user approval.
- Do not commit runtime DB, smoke DB, logs, or build output.
