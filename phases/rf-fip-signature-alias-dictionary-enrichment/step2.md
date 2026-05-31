## 읽어야 할 파일
- `docs/API_CONTRACTS.md`
- `docs/DATA_MODEL.md`
- `client/src/lib/signatureAliasResolver.ts`
- `server/rfFipApi.ts`
- `server/rfFipStore.ts`

## 작업
사용자 승인 alias overlay를 persisted API와 resolver에 연결한다.

## Scope
- 새 collection `signatureAliasDictionary`.
- 새 API `GET/PUT /api/signature-aliases`.
- resolver는 built-in approved alias와 user-approved overlay만 자동 canonicalize한다.
- Chat pending alias candidate에는 작은 승인 action만 제공한다.

## Acceptance Criteria
- approved overlay alias는 Chat/Import/Similarity에서 같은 resolver를 통해 동작한다.
- pending/imported alias는 자동 canonicalize되지 않는다.
- 기존 `signatureDictionary` API는 유지한다.

## 검증 절차
- `node scripts/rf-fip-signature-alias-dictionary-smoke.mjs`
- `node scripts/rf-fip-smoke.mjs`
- `node scripts/rf-fip-sqlite-smoke.mjs`

## 금지사항
- 대형 관리자 UI 추가 금지.
- 승인 전 alias를 분석 결과에 반영 금지.

## Verdict
PASS
