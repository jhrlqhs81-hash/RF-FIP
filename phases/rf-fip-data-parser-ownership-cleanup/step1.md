## 읽어야 할 파일
- `docs/README.md`
- `docs/DATA_MODEL.md`
- `client/src/lib/similarCasesDb.ts`
- `client/src/pages/Home.tsx`

## 작업
Default Knowledge seed cases를 similarity 계산 모듈 밖으로 분리한다.

## Scope
- `knowledgeSeedCases.ts`가 기본 seed data를 소유한다.
- `similarCasesDb.ts`는 type, similarity scoring, retrieval helper만 소유한다.
- app caller는 현재 state의 `knowledgeCases`를 명시적으로 전달한다.

## Acceptance Criteria
- `findSimilarCases()`는 암묵적인 seed DB에 의존하지 않는다.
- Home, Chat, Import, Similar tab이 같은 Knowledge case state를 사용한다.
- 기존 `KnowledgeCase` shape은 유지한다.

## 검증 절차
- `node scripts/rf-fip-data-parser-ownership-smoke.mjs`
- `node scripts/rf-fip-evidence-packet-smoke.mjs`
- `tsc --noEmit`

## 금지사항
- persisted Knowledge DB shape 변경 금지.
- runtime `.rf-fip-db/` 데이터 commit 금지.

## Verdict
PASS

## Notes
기본 seed는 `DEFAULT_KNOWLEDGE_CASES`로 분리했고, similarity 엔진은 호출자가 넘긴 case 목록만 검색한다.
