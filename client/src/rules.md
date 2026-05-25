# Client Src Rules

- Avoid broad refactors across pages/components/lib in one step.
- Do not duplicate API request logic outside `lib/`.
- Do not add decorative UI that obscures dense RF analysis workflows.
- Preserve RF-FIP workflow: Issue -> Chat -> Signature -> RCA -> Knowledge DB.
- Run typecheck after changing shared TypeScript types.
