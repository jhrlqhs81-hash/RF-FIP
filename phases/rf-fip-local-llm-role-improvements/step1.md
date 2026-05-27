# Step 1: hybrid-hypothesis-schema

## 읽어야 할 파일

- `docs/README.md`
- `docs/LLM_GAUSS_CONTRACT.md`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/components/HypothesisDetailPanel.tsx`

## 작업

LLM이 Local Evidence Packet id 안에서만 가설을 순위화하고 설명하도록 schema를 만든다.

## Acceptance Criteria

- schema는 `title`, `confidence`, `supportingEvidenceIds`, `rejectedEvidenceIds`, `mechanism`, `nextActions`, `missingInfo`를 포함한다.
- 모든 evidence id 참조는 packet 내부 id만 허용한다.
- 기존 가설 패널로 mapping 가능하다.

## 검증 절차

- schema validation smoke
- `tsc --noEmit`
- `node scripts/harness-policy-check.mjs`

## 금지사항

- packet 밖 근거를 LLM이 임의 생성하게 하지 않는다.
- UI 대규모 재설계를 하지 않는다.
