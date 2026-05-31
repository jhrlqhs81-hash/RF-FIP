## 읽어야 할 파일
- `docs/SIGNATURE_ONTOLOGY.md`
- `client/src/lib/signatureConceptRegistry.ts`

## 작업
RF/기구/시험/증상 표현의 built-in alias coverage를 확장한다.

## Scope
- 기존 `SignatureConceptRegistry` shape 유지.
- concept/value/relation 구조는 변경하지 않고 alias 목록 중심으로 확장.
- generic boolean/result value의 value-only canonicalization 금지 유지.

## Acceptance Criteria
- Back Glass, Conducted, OTA, noise floor, spur, broadband noise, channel-specific fail, 2-tone PIM 표현이 추출된다.
- pending 후보와 approved alias 정책은 유지된다.

## 검증 절차
- `node scripts/rf-fip-signature-alias-dictionary-smoke.mjs`
- `node scripts/rf-fip-signature-concept-ontology-smoke.mjs`

## 금지사항
- 모호한 용어를 여러 concept에 자동 승인하지 않는다.
- LLM 제안을 즉시 built-in alias로 넣지 않는다.

## Verdict
PASS
