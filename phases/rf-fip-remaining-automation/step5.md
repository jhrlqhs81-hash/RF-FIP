# Step 5: gauss-adapter-contract

## 읽어야 할 파일

- `client/src/lib/localRfAnalyzer.ts`
- `docs/README.md`
- `docs/LLM_GAUSS_CONTRACT.md`
- `docs/API_CONTRACTS.md`
- `docs/RF_DOMAIN_SPEC.md`
- `client/src/lib/rfFipApi.ts`
- `server/rfFipApi.ts`
- `RF_DESENSE_TAXONOMY.md`
- `phases/rf-fip-remaining-automation/index.json`의 이전 completed step summaries

## 작업

Gauss 실제 API 스펙이 없어도 진행 가능한 adapter contract와 mock fallback을 만든다. 실제 외부 호출은 스펙이 들어오기 전까지 `blocked`로 남긴다.

구현 대상:

1. 서버 전용 LLM adapter interface를 정의한다.
2. `local` provider는 현재 `localRfAnalyzer` 수준의 deterministic fallback을 사용한다.
3. `gauss` provider는 필요한 env/schema가 없으면 명확한 501/blocked style error를 반환한다.
4. request/response DTO를 고정한다:
   - chat reply
   - raw import first-pass classification
   - RCA summary draft enrichment
   - signature extraction/normalization
   - attachment text/table analysis
5. Gauss 스펙 수령 시 채워야 할 TODO를 한 파일에 모은다.

## Acceptance Criteria

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
```

Mock adapter smoke:

```powershell
node .\scripts\rf-fip-llm-adapter-smoke.mjs
```

## 검증 절차

1. `LLM_PROVIDER=local`에서 mock/local response가 deterministic하게 나온다.
2. `LLM_PROVIDER=gauss`인데 필수 env가 없으면 외부 호출 없이 명확한 error가 나온다.
3. API key나 secret이 로그, DB, client bundle에 노출되지 않는지 확인한다.
4. 실제 Gauss endpoint/schema가 없으면 step 5는 contract 부분 `completed`, 실제 호출 부분은 별도 blocked item으로 기록한다.

## 금지사항

- Gauss endpoint나 schema를 추측해서 실제 호출 코드를 완성하지 마라. 이유: 잘못된 외부 API 계약은 후속 디버깅 비용이 크다.
- API key를 client code에 넣지 마라. 이유: secret 노출.
- local fallback 품질을 Gauss 품질로 주장하지 마라. 이유: 검증 범위가 다르다.
