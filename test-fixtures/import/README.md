# Knowledge DB Import Fixture

이 폴더는 제품 UI 기능이 아니라 Knowledge DB Import 흐름을 점검하기 위한 개발/검증용 RAW 사례를 보관합니다.

## Fixture

- `rf-desense-pim-sample.csv`

이 CSV는 3개 RAW 사례를 포함합니다.

- `RAW-001`: TX-induced PIM / Shield Clip 통과 후보
- `RAW-002`: Internal Desense / Display MIPI 통과 후보
- `RAW-003`: RF 단서 부족 보류 후보

## 점검 순서

1. `http://localhost:3199/` 접속
2. 상단 `Knowledge DB` 이동
3. 좌측 상단 `Import` 버튼 클릭
4. `rf-desense-pim-sample.csv` 선택
5. 후보 검토 모달에서 통과 후보와 보류 후보가 분리되는지 확인
6. 통과 후보를 클릭해 선별 이유, 추출 Signature, Knowledge DB 상세 양식, 사용자료 확인
7. 등록할 후보를 체크하고 `선택 후보 DB 등록 승인` 클릭
8. 새 `KB-LOCAL-*` 사례들이 Knowledge DB 목록에 추가되는지 확인
9. 등록 사례 상세의 `사용자료`를 클릭해 상세 모달이 열리는지 확인

최종 프로그램에는 별도 샘플 버튼을 추가하지 않습니다. 실제 사용자 흐름과 동일하게 `Import` 버튼으로 fixture를 선택해 점검합니다.
