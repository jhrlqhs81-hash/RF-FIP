## 읽어야 할 파일
- `docs/RAG_CONTRACT.md`
- `docs/API_CONTRACTS.md`
- `docs/AI_ROLE_CHECKLIST.md`
- `docs/TEST_PLAN.md`

## 작업
Define the RF-FIP RAG contract and seed public-safe local RF Wiki documents.

## Scope
- Add `docs/RAG_CONTRACT.md`.
- Add `docs/rf-wiki/*.md` seed files for conducted/OTA, Tx PIM, IM frequency check, mechanical pressure A/B, and internal spur/function ON/OFF.
- Mark all seed documents `local-public`, `public-safe`, and allowed for `local`, `openai`, and `gauss`.
- Keep internal Wiki/Gauss content contract-only.

## Acceptance Criteria
- RAG contract states that Local Evidence remains source of truth.
- Local public wiki documents have explicit security/provider metadata.
- Internal/Gauss Wiki is not enabled without its URL/key/schema/classification contract.

## 검증 절차
- `node scripts/rf-fip-rag-contract-smoke.mjs`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Do not add confidential or internal-only content to `docs/rf-wiki`.
- Do not send internal-only snippets to OpenAI.

## Verdict
PASS
