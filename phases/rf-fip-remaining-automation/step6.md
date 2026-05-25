# Step 6: release-shape-and-git

## 읽어야 할 파일

- `package.json`
- `docs/README.md`
- `docs/HARNESS_POLICY.md`
- `docs/TEST_PLAN.md`
- `docs/REGRESSION_CHECKLIST.md`
- `.gitignore`
- `.codex/context/session-summary.md`
- `phases/rf-fip-remaining-automation/index.json`
- 모든 completed step summaries

## 작업

자동화 개발 결과를 배포/형상관리 가능한 상태로 정리한다.

구현 대상:

1. 현재 폴더가 git repo인지 확인한다.
2. git repo가 아니면 사용자에게 다음 둘 중 하나를 선택받는다:
   - 실제 `.git`이 있는 상위/다른 폴더로 이동
   - 이 폴더를 새 repo로 초기화하고 remote 연결
3. runtime DB, smoke DB, log, build output, dependency directory가 git에 포함되지 않는지 확인한다.
4. README 또는 `.codex/context/session-summary.md`에 실행/검증 명령을 최신화한다.
5. phase 전체 완료 여부를 `phases/index.json`과 `phases/rf-fip-remaining-automation/index.json`에 반영한다.

## Acceptance Criteria

```powershell
git status --short
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
```

Git repo가 없는 경우:

- step 6을 `blocked`로 기록한다.
- `blocked_reason`에 “git repository/remote decision required”를 명시한다.

## 검증 절차

1. 변경 파일과 생성 파일 목록을 확인한다.
2. 빌드/타입체크/smoke 결과를 최종 요약한다.
3. git staging/commit/push는 사용자 승인 전 수행하지 않는다.
4. 성공 또는 blocked 상태를 phase index에 반영한다.

## 금지사항

- 사용자 승인 없이 `git init`, remote 추가, commit, push를 하지 마라. 이유: 형상관리 경계는 사용자 결정 사항이다.
- build output이나 runtime DB를 stage하지 마라. 이유: repo 오염.
- 실패한 step을 completed로 바꾸지 마라. 이유: Harness 자동화의 재개 지점이 깨진다.
