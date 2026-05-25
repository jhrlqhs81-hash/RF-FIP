# PRD: RF Failure Intelligence Platform

## 목표

RF desense 이슈를 채팅, Signature, RCA Summary, Knowledge DB로 연결해 분석 재사용성을 높인다.

## 사용자

- RF/OTA 분석 담당자
- RCA 검토자
- Knowledge DB를 재사용하는 후속 분석자

## 핵심 기능

1. 이슈 생성 및 분석 채팅
2. Signature 추출/정규화
3. Knowledge DB 사례 저장/검색
4. RAW/Excel Import 후보 선별
5. RCA Summary 작성 및 DB 승인
6. Gauss 연동 준비 및 local fallback

## MVP 제외

- Gauss 실제 호출: API schema 수령 전 blocked
- 외부 계정/권한 시스템
- 대용량 운영 DB 튜닝

## 완료 기준

- 주요 API와 UI flow가 typed build를 통과한다.
- Import/Knowledge/Issue 저장이 재시작 후 유지된다.
- `REGRESSION_CHECKLIST.md` 위반이 없다.
