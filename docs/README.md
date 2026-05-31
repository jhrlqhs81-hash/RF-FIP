# RF-FIP Docs Index

Harness phase 설계와 실행은 아래 문서를 출발점으로 삼는다.

## Required Reads By Default

- `PRD.md`: 제품 목표, 사용자, 완료 기준
- `ARCHITECTURE.md`: 디렉토리, API, persistence 경계
- `DATA_MODEL.md`: Issue, KnowledgeCase, Import, Signature 계약
- `API_CONTRACTS.md`: 서버 API request/response shape
- `UI_UX_SPEC.md`: 핵심 화면과 상태
- `REGRESSION_CHECKLIST.md`: 완료 전 회귀 기준
- `TEST_PLAN.md`: 실행 가능한 검증 명령
- `HARNESS_POLICY.md`: AGENTS/rules/phases 운영 규칙

## Domain Reads

- `RF_DOMAIN_SPEC.md`: RF desense taxonomy 참조 규칙
- `IMPORT_SPEC.md`: RAW/Excel import 기준
- `LLM_GAUSS_CONTRACT.md`: Gauss adapter 계약과 blocked 조건
- `AI_ROLE_CHECKLIST.md`: Local Engine, LLM, Hybrid 역할 분리와 회귀 체크리스트
- `SIGNATURE_ONTOLOGY.md`: Signature key 계층, 동의어, 관계 규칙, 검증 기준
- `RF_HARDCODE_REVIEW.md`: RF 조건/리스트 하드코딩 판정과 통합 기준
- `GAUSS_INTERNAL_HANDOFF.md`: 사내 PC/네트워크에서 실제 Gauss 연동을 시작하기 위한 체크리스트

## Decision Records

- `ADR/`: 구조적 결정, trade-off, 상태 기록

## Do Not Put Here

- 긴 command output
- raw logs
- secret/API key
- 임시 디버그 메모
- phase 실행 상태 전문
