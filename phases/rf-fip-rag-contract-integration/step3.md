## 읽어야 할 파일
- `docs/RAG_CONTRACT.md`
- `docs/TEST_PLAN.md`
- `phases/index.json`
- `phases/rf-fip-rag-contract-integration/index.json`

## 작업
Record the RAG phase and add regression checks.

## Scope
- Add `smoke:rag-contract`.
- Update LLM prompt contract smoke for RAG context and wiki source ids.
- Update API, AI role, and test docs.
- Register the HARNESS phase.

## Acceptance Criteria
- RAG smoke verifies public-safe filtering, task scoping, Gauss blocked contract, and LLM adapter injection.
- HARNESS policy includes the new phase.
- Existing LLM prompt guard still passes.

## 검증 절차
- `node scripts/rf-fip-rag-contract-smoke.mjs`
- `node scripts/rf-fip-llm-prompt-contract-smoke.mjs`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Do not claim internal Wiki/Gauss real integration until the internal contract is supplied and verified.
- Do not claim browser E2E if Browser connector is unavailable.

## Verdict
PASS_WITH_RISK

## Verification Note
- Passed: `node scripts/rf-fip-rag-contract-smoke.mjs`.
- Passed: `node scripts/rf-fip-llm-prompt-contract-smoke.mjs`.
- Passed: `.\node_modules\.bin\tsc.cmd -p .\tsconfig.json --noEmit`.
- Passed: `.\node_modules\.bin\vite.cmd build --config .\vite.config.ts`.
- Passed: `.\node_modules\.bin\esbuild.cmd .\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=.\dist`.
- Passed: `node scripts/harness-policy-check.mjs`.
- Passed: `git diff --check` with CRLF warnings only.
- Passed: dev server HTTP 200 at `http://127.0.0.1:5173/`.
- Residual risk: Browser click-through was not rerun because the Browser connector remains environment-blocked.
