# Step 0: qa-harness-baseline

## 읽어야 할 파일

먼저 아래 파일을 읽고 현재 RF-FIP 구조, 검증 명령, 남은 리스크를 파악하라:

- `../AGENTS.md`
- `docs/README.md`
- `docs/HARNESS_POLICY.md`
- `docs/TEST_PLAN.md`
- `docs/REGRESSION_CHECKLIST.md`
- `README.md`
- `RF_DESENSE_TAXONOMY.md`
- `.codex/context/session-summary.md`
- `package.json`
- `vite.config.ts`
- `server/rfFipApi.ts`
- `server/rfFipStore.ts`
- `client/src/lib/rfFipApi.ts`
- `client/src/pages/Home.tsx`

## 작업

남은 작업 자동화를 실행하기 전 기준선을 고정한다.

1. 현재 구현된 API surface를 표로 정리한다: `/api/issues`, `/api/knowledge-cases`, `/api/signature-dictionary`, `/api/import-results`, `/api/health`.
2. `.codex/context/session-summary.md`의 최신 검증 결과와 실제 명령이 일치하는지 확인한다.
3. 검증용 smoke script를 추가할지 판단한다. 추가한다면 외부 dependency 없이 Node built-in만 사용하고, 실제 사용자 DB가 아닌 `RF_FIP_DB_DIR=.rf-fip-db/smoke-*` 하위만 사용한다.
4. 후속 step들이 공통으로 사용할 verification checklist를 `.codex/context/tool-results.md` 또는 별도 짧은 문서에 기록한다.

## Acceptance Criteria

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
```

추가 smoke script를 만든 경우:

```powershell
node .\scripts\rf-fip-smoke.mjs
```

## 검증 절차

1. 위 AC 명령을 실행한다.
2. Vite build에 chunk size warning이 다시 나타나지 않는지 확인한다.
3. smoke DB가 `.rf-fip-db/smoke-*` 밖에 쓰지 않는지 확인한다.
4. 성공 시 `phases/rf-fip-remaining-automation/index.json`의 step 0을 `completed`로 갱신하고, `summary`에 기준선 명령과 결과를 한 줄로 기록한다.

## 금지사항

- 실제 `.rf-fip-db/rf-fip.json` 사용자 데이터를 smoke test에서 수정하지 마라. 이유: 검증 데이터와 사용자 작업 데이터가 섞인다.
- dependency 추가를 하지 마라. 이유: 이 step은 기준선 고정만 담당한다.
- UI 리팩터링을 하지 마라. 이유: 후속 step의 실패 원인을 분리하기 어렵다.
