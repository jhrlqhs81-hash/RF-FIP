# Scripts Rules

- Do not require network access in policy checks.
- Do not write to real user DB from smoke scripts.
- Exit non-zero on policy violations.
- Keep output concise and actionable.
- Prefer explicit file paths over broad mutation.
- Production smoke scripts that load `node_modules` may require escalated execution in the Codex sandbox; record EPERM as environment-related when the same script passes with escalation.
