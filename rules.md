# Project Rules

- Always consult `docs/README.md` before creating or executing phases.
- Do not bypass server APIs to write RF-FIP data from the client.
- Runtime data belongs under `.rf-fip-db/` and must not be committed.
- Build output under `dist/` must not be treated as source.
- If `AGENTS.md` or `CLAUDE.md` exceeds 70 lines, split scope into child directories.
- On failure or warning, update the nearest applicable `rules.md` with a short enforceable rule.
- Completion requires `docs/TEST_PLAN.md` and `docs/REGRESSION_CHECKLIST.md` evidence.
