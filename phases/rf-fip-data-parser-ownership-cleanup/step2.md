## 읽어야 할 파일
- `docs/IMPORT_SPEC.md`
- `client/src/lib/importParser.ts`
- `client/src/pages/Home.tsx`

## 작업
Import field/header/text split heuristic을 shared parser profile로 모은다.

## Scope
- `DEFAULT_IMPORT_PARSER_PROFILE`을 추가한다.
- CSV/TSV/XLSX/TXT parser가 같은 profile contract를 사용한다.
- Home에 남은 미사용 second parser 구현을 제거한다.

## Acceptance Criteria
- Import upload path는 `readImportFile()`만 사용한다.
- custom parser profile로 header alias를 확장할 수 있다.
- 기존 CSV/XLSX smoke 동작은 유지한다.

## 검증 절차
- `node scripts/rf-fip-import-parser-smoke.mjs`
- `node scripts/rf-fip-data-parser-ownership-smoke.mjs`

## 금지사항
- 새 parser dependency 추가 금지.
- `.xls` binary parsing 지원 상태를 거짓으로 완료 처리 금지.

## Verdict
PASS

## Notes
Parser heuristic은 profile 기반으로 노출했고, Home의 중복 parser 함수는 제거했다.
