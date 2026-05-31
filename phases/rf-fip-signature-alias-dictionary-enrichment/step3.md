## 읽어야 할 파일
- `docs/TEST_PLAN.md`
- `docs/RF_HARDCODE_REVIEW.md`
- `phases/rf-fip-signature-alias-dictionary-enrichment/index.json`

## 작업
동의어 사전 풍부화와 승인 overlay 변경을 검증하고 기록한다.

## Scope
- 새 smoke와 관련 회귀 smoke 실행.
- typecheck/build/server bundle/policy check 실행.
- 문서와 phase index 갱신.

## Acceptance Criteria
- 새 smoke와 기존 alias/concept/evidence/similarity 회귀가 통과한다.
- API/store 추가가 production smoke와 SQLite restart smoke에서 검증된다.
- Harness policy check가 통과한다.

## 검증 절차
- `node scripts/rf-fip-signature-alias-dictionary-smoke.mjs`
- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`
- `node scripts/rf-fip-signature-alias-resolver-smoke.mjs`
- `node scripts/rf-fip-signature-synonym-smoke.mjs`
- `node scripts/rf-fip-evidence-packet-smoke.mjs`
- `node scripts/rf-fip-classification-similarity-cleanup-smoke.mjs`
- `tsc --noEmit`
- `vite build`
- server `esbuild`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- push는 명시 요청 전까지 하지 않는다.
- Browser click-through는 별도 요청 없이 완료 조건으로 주장하지 않는다.

## Verdict
PASS
