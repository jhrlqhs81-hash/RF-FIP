# Step 2: excel-import-parser

## 읽어야 할 파일

- `package.json`
- `docs/README.md`
- `docs/IMPORT_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_PLAN.md`
- `client/src/pages/Home.tsx`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/lib/rfFipApi.ts`
- `test-fixtures/import/README.md`
- `test-fixtures/import/rf-desense-pim-sample.csv`
- `phases/rf-fip-remaining-automation/index.json`의 이전 completed step summaries

## 작업

Import에서 `.xlsx/.xls` 셀 파싱을 지원한다.

계약:

```ts
type ParsedImportSource = {
  title?: string;
  text: string;
  materials: ChatAttachment[];
};

async function readImportFile(file: File): Promise<ParsedImportSource[]>;
```

구현 방향:

1. Excel parser dependency가 이미 있으면 사용한다.
2. 없으면 dependency 추가가 필요한지 판단한다. dependency 추가가 필요하면 `package.json`과 lockfile 변경을 포함하고, 변경 이유를 step summary에 기록한다.
3. Excel workbook의 각 sheet를 rows로 변환하고, header가 있는 sheet는 row별 raw case로 분리한다.
4. sheet/row 원본은 `ChatAttachment.type = "table"`의 `rows`에 연결한다.
5. 기존 CSV/TSV/JSON/TXT import 동작을 깨지 않는다.

## Acceptance Criteria

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
```

Excel fixture 또는 새로 만든 최소 workbook fixture가 있다면:

```powershell
node .\scripts\rf-fip-import-parser-smoke.mjs
```

## 검증 절차

1. CSV fixture의 기존 3개 RAW case 분리가 유지되는지 확인한다.
2. Excel fixture에서 최소 2개 row가 후보/보류 candidate로 분리되는지 확인한다.
3. `원본 보기` 모달에 Excel sheet rows가 table material로 연결되는지 확인한다.
4. 성공 시 step 2를 `completed`로 갱신한다.

## 금지사항

- Excel을 단순 파일명/크기 metadata만으로 처리하지 마라. 이유: 이 step의 목표는 셀 원문 분석이다.
- CSV/TSV parser를 Excel 전용 로직에 종속시키지 마라. 이유: 기존 Import 회귀 방지.
- 전체 UI를 리팩터링하지 마라. 이유: parser scope를 벗어난다.
