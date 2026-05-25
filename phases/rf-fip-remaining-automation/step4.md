# Step 4: import-workflow-hardening

## 읽어야 할 파일

- `client/src/pages/Home.tsx`
- `docs/README.md`
- `docs/IMPORT_SPEC.md`
- `docs/UI_UX_SPEC.md`
- `docs/REGRESSION_CHECKLIST.md`
- `client/src/components/CaseDetailView.tsx`
- `client/src/lib/similarCasesDb.ts`
- `client/src/lib/localRfAnalyzer.ts`
- `server/rfFipStore.ts`
- `server/rfFipApi.ts`
- `phases/rf-fip-remaining-automation/index.json`의 이전 completed step summaries

## 작업

Import 후보 검토 흐름을 운영 가능한 수준으로 고도화한다.

구현 대상:

1. 보류 후보를 사용자가 수정 후 승인할 수 있게 한다.
2. 중복 감지를 현재 normalized key에서 signature similarity 기반으로 확장한다.
3. Import 결과 이력을 조회하는 UI를 Knowledge DB 안에 추가한다.
4. 후보 상세에서 기존 Knowledge DB 유사 사례를 표시한다.
5. 원본 보기 모달에서 raw text와 table material이 함께 보이는 상태를 유지한다.

계약 예시:

```ts
function findDuplicateImportCase(candidate: KnowledgeCase, existing: KnowledgeCase[]): {
  duplicate: boolean;
  reason: string;
  matchedCaseId?: string;
  similarity?: number;
};
```

## Acceptance Criteria

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
```

가능하면 browser/e2e 검증:

- CSV fixture import
- candidate 1건 승인
- hold 1건 수정 후 승인
- duplicate 1건 skip
- import history 표시 확인

## 검증 절차

1. 기존 CSV fixture로 Import 모달이 열리는지 확인한다.
2. 통과/보류 후보가 분리되는지 확인한다.
3. 보류 후보 수정 후 승인이 Knowledge DB에 저장되는지 확인한다.
4. 중복 후보는 저장되지 않고 skip reason이 표시되는지 확인한다.
5. 성공 시 step 4를 `completed`로 갱신한다.

## 금지사항

- Gauss API를 호출하지 마라. 이유: 이 step은 local rule/parser 기반 workflow hardening이다.
- Knowledge DB 상세 양식을 바꾸지 마라. 이유: 기존 RCA Summary/CaseDetailView 계약 유지.
- 중복 감지를 title만으로 판단하지 마라. 이유: RF case는 같은 title이라도 band/mechanism/signature가 다를 수 있다.
