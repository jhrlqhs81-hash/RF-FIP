# Step 3: signature-normalization-synonyms

## 읽어야 할 파일

- `docs/README.md`
- `docs/RF_DOMAIN_SPEC.md`
- `client/src/lib/localRfAnalyzer.ts`
- `client/src/lib/similarCasesDb.ts`

## 작업

새 NLP dependency 없이 RF 한국어/영어 synonym mapping으로 signature recall과 유사도 품질을 개선한다.

## Acceptance Criteria

- 감도 저하/desense/sensitivity drop 등 핵심 동의어가 같은 signature 의미로 정규화된다.
- shield can, contact force, reassembly, conducted/OTA 용어가 local rule에 반영된다.
- 유사 사례 검색 score가 기존 exact match와 호환된다.

## 검증 절차

- signature synonym smoke
- `tsc --noEmit`
- `node scripts/harness-policy-check.mjs`

## 금지사항

- KoNLPy, Transformers, LangChain 같은 dependency를 이 step에서 추가하지 않는다.
- 기존 signature key contract를 깨지 않는다.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: `tsc --noEmit`, `rf-fip-signature-synonym-smoke.mjs`, `harness-policy-check.mjs`, Vite build
- Notes: Added no-dependency RF Korean/English synonym extraction and similarity value normalization without changing the signature key contract.
