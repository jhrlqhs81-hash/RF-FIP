# Step 4: import-reason-enrichment

## 읽어야 할 파일

- `docs/README.md`
- `docs/IMPORT_SPEC.md`
- `client/src/pages/Home.tsx`
- `client/src/lib/importParser.ts`
- `client/src/lib/localRfAnalyzer.ts`

## 작업

Import 후보의 pass, hold, duplicate 사유를 local facts 기반으로 분리하고 LLM은 설명 보강에만 사용한다.

## Acceptance Criteria

- deterministic status decision과 explanation text가 분리된다.
- Import 후보가 Local Evidence Packet의 핵심 facts를 보유한다.
- 원본 보기와 중복 검토 흐름이 유지된다.

## 검증 절차

- import parser smoke
- reason-shape smoke
- `node scripts/harness-policy-check.mjs`

## 금지사항

- Import status를 LLM 단독 판단에 맡기지 않는다.
- 원본 보기 기능을 제거하지 않는다.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: `tsc --noEmit`, `rf-fip-import-reason-shape-smoke.mjs`, `harness-policy-check.mjs`, Vite build
- Notes: Import candidates now keep deterministic decision shape, local evidence facts, and evidence packets while preserving original-view modal and duplicate matching.
