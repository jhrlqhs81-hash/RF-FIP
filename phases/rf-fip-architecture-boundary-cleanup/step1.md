## 읽어야 할 파일
- `docs/ARCHITECTURE.md`
- `docs/REGRESSION_CHECKLIST.md`
- `client/src/pages/Home.tsx`
- `client/src/lib/importParser.ts`
- `client/src/lib/localRfAnalyzer.ts`

## 작업
Move Import candidate analysis responsibilities from `Home.tsx` into `client/src/lib/importCandidateAnalyzer.ts`.

## Scope
- Extract Import candidate types and deterministic candidate generation.
- Extract duplicate matching, source-material tracing, and Import status decision logic.
- Keep `Home.tsx` responsible for file selection, UI state, approval, and toast flow only.
- Keep persisted API and Knowledge DB approval behavior unchanged.

## Acceptance Criteria
- `Home.tsx` no longer declares `ImportCandidate` or builds Import candidates directly.
- `Home.tsx` calls a library boundary to create candidates from files.
- Import original-view materials, local evidence packet, duplicate matching, and approval filtering still have a single callable owner.
- No server API contract changes are required.

## 검증 절차
- `node scripts/rf-fip-architecture-boundary-smoke.mjs`
- `tsc --noEmit`
- `vite build`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Do not remove Import review UI or original source modal.
- Do not move browser-only File parsing to the server in this slice.
- Do not change Knowledge DB persistence schema.

## Verdict
PASS
