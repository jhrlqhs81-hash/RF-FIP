# Step 3: sqlite-store-backend

## 읽어야 할 파일

- `server/rfFipStore.ts`
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACTS.md`
- `docs/TEST_PLAN.md`
- `server/rfFipApi.ts`
- `client/src/lib/rfFipApi.ts`
- `package.json`
- `.gitignore`
- `phases/rf-fip-remaining-automation/index.json`의 이전 completed step summaries

## 작업

현재 JSON file-backed store를 SQLite-backed store로 교체한다. API 계약은 유지하고, 프론트엔드 호출부는 바꾸지 않는 것을 기본값으로 한다.

저장 대상:

- issues
- knowledgeCases
- signatureDictionary
- importResults

계약:

```ts
export function getRfFipDbSnapshot(): RfFipDb;
export function saveIssue(item: PersistedIssue): PersistedIssue;
export function saveKnowledgeCase(item: PersistedKnowledgeCase): PersistedKnowledgeCase;
export function replaceSignatureDictionary(items: PersistedSignature[]): PersistedSignature[];
export function saveImportResult(item: PersistedImportResult): PersistedImportResult;
```

구현 방향:

1. SQLite dependency가 이미 있으면 사용한다.
2. 없으면 `better-sqlite3` 또는 현재 runtime에서 안정적인 대안을 선택하고, dependency 변경 근거를 기록한다.
3. JSON fields는 우선 `TEXT JSON`으로 저장해 API shape를 보존한다.
4. DB path는 `RF_FIP_DB_DIR` 아래에 두고, 기본 파일명은 `rf-fip.sqlite`로 한다.
5. 기존 `.rf-fip-db/rf-fip.json`이 존재하면 1회 migration을 제공하거나, migration 미지원이면 명확히 문서화한다.

## Acceptance Criteria

```powershell
.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit
.\node_modules\.bin\vite.cmd build --config .\vite.config.ts
.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist
```

SQLite smoke:

```powershell
node .\scripts\rf-fip-sqlite-smoke.mjs
```

## 검증 절차

1. smoke DB에 issue, knowledge case, signature dictionary, import result를 저장한다.
2. 서버 재시작 후 같은 값이 조회되는지 확인한다.
3. `.gitignore`가 SQLite runtime DB를 제외하는지 확인한다.
4. 성공 시 step 3을 `completed`로 갱신한다.

## 금지사항

- API response shape를 바꾸지 마라. 이유: 프론트와 이전 step이 의존한다.
- 사용자 DB를 migration smoke 대상으로 사용하지 마라. 이유: 데이터 손상 위험.
- SQLite 전환과 Import UX 개선을 한 step에서 섞지 마라. 이유: 실패 원인 분리가 어렵다.
