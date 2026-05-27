# Step 5: attachment-evidence-linking

## 읽어야 할 파일

- `docs/README.md`
- `docs/DATA_MODEL.md`
- `client/src/components/CaseDetailView.tsx`
- `client/src/lib/localRfAnalyzer.ts`

## 작업

첨부자료 metadata와 parsed table rows를 evidence packet entry로 연결한다.

## Acceptance Criteria

- 첨부/표 기반 evidence entry가 source와 weight를 가진다.
- binary/image deep analysis는 later OCR/LLM adapter 뒤로 남긴다.
- 상세 보기에서 attachment-derived evidence를 추적할 수 있다.

## 검증 절차

- attachment fixture smoke
- `tsc --noEmit`
- `node scripts/harness-policy-check.mjs`

## 금지사항

- 이미지 OCR을 이 step에서 hand-roll하지 않는다.
- 파일 원문 전체를 로그나 docs에 저장하지 않는다.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: `tsc --noEmit`, `rf-fip-attachment-evidence-smoke.mjs`, existing evidence/hypothesis smokes, `harness-policy-check.mjs`, Vite build, server esbuild
- Notes: Attachment metadata and parsed table rows now create Local Evidence Packet entries. OCR/image deep analysis remains deferred to future adapter work.
