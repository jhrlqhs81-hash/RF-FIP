# Step 1: browser-e2e-unblock

## 읽어야 할 파일

- `.codex/context/session-summary.md`
- `docs/README.md`
- `docs/UI_UX_SPEC.md`
- `docs/TEST_PLAN.md`
- `docs/REGRESSION_CHECKLIST.md`
- `vite.config.ts`
- `server/index.ts`
- `client/src/pages/Home.tsx`
- `client/src/lib/rfFipApi.ts`
- `phases/rf-fip-remaining-automation/step0.md`
- `phases/rf-fip-remaining-automation/index.json`의 step 0 summary

## 작업

in-app browser가 local URL을 `net::ERR_BLOCKED_BY_CLIENT`로 차단한 리스크를 자동 검증 가능한 방식으로 해소한다.

우선순위:

1. Vite dev server 또는 production server를 Browser plugin이 접근 가능한 host/port로 띄울 수 있는지 확인한다.
2. Browser plugin 접근이 계속 막히면, UI 검증용 Playwright/브라우저 dependency를 새로 추가하지 말고 Node built-in 기반 DOM smoke 또는 Vite preview 접근 가능성을 먼저 평가한다.
3. 최종적으로 자동 검증 가능한 경로를 하나 고정한다:
   - 가능하면 Browser plugin으로 실제 클릭 검증
   - 불가능하면 차단 원인을 명시하고, API smoke + build artifact static smoke를 대체 검증으로 문서화

검증 대상 UI:

- 좌측 `+` 버튼 클릭 시 `새 이슈 생성` 모달이 열린다.
- Title/Model/Band 입력 후 생성하면 `/api/issues` POST가 발생하고 새 이슈가 목록에서 선택된다.
- Knowledge DB Import 검토 모달에서 `원본 보기` 버튼이 full raw text 모달을 연다.

## Acceptance Criteria

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
```

그리고 둘 중 하나를 만족해야 한다.

1. Browser plugin 또는 브라우저 자동화로 위 UI 3개 흐름을 실제 클릭 검증하고 결과를 기록한다.
2. 브라우저 접근이 환경 차단이면 `blocked_reason`에 차단 URL, 에러 문자열, 대체 검증 근거를 기록하고 step을 `blocked`로 종료한다.

## 검증 절차

1. 브라우저 접근 가능 여부를 먼저 확인한다.
2. 가능하면 이슈 생성과 Import 원본 보기 흐름을 각각 한 번 실행한다.
3. 생성된 검증 이슈는 smoke DB 또는 테스트 전용 runtime에만 저장한다.
4. 결과에 따라 step 1을 `completed` 또는 `blocked`로 갱신한다.

## 금지사항

- 브라우저 접근 실패를 숨기고 `completed`로 처리하지 마라. 이유: UI 회귀가 검증되지 않는다.
- 실제 사용자 DB에 테스트 이슈를 남기지 마라. 이유: 분석 데이터 오염.
- 외부 dependency를 이 step에서 추가하지 마라. 이유: 브라우저 접근성 문제와 dependency 문제를 분리해야 한다.
