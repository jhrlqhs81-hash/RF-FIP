# Phases Rules

- Every task needs `phases/{task}/index.json` and `stepN.md` files.
- Step names must be kebab-case.
- Do not write “as discussed earlier” in step files.
- Include docs paths and changed-file paths in each step read list.
- On blocked/error, record the reason in the task index.
- If Browser plugin blocks local URLs with `net::ERR_BLOCKED_BY_CLIENT`, mark the browser step `blocked` and continue only with independent non-browser steps when explicitly requested.
