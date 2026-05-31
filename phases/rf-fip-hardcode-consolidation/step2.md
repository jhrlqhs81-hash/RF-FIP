# Step 2: shared-rule-catalog

## 읽어야 할 파일

- `shared/AGENTS.md`
- `shared/rules.md`
- `shared/rfFipRuleCatalog.ts`
- `docs/RF_HARDCODE_REVIEW.md`

## 작업

Create one deterministic shared RF rule catalog for cross-runtime rules.

## Acceptance Criteria

- Shared catalog exposes RF intent detection.
- Shared catalog exposes core RF signature extraction.
- Shared catalog exposes server-safe local fallback classification.
- Shared code imports neither client nor server modules.

## 검증 절차

- `node scripts/rf-fip-hardcode-consolidation-smoke.mjs`
- `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`

## 금지사항

- Do not import client or server modules into `shared/`.
- Do not add network, storage, DOM, or provider calls to shared rules.

## Verdict

- Status: completed
- Verdict: PASS
