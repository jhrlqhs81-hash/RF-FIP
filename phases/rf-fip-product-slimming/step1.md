## 읽어야 할 파일
- `docs/UI_UX_SPEC.md`
- `docs/REGRESSION_CHECKLIST.md`
- `client/src/pages/Home.tsx`
- `client/src/components/SignaturePanel.tsx`

## 작업
Low-risk product slimming only: remove UI residue that cannot affect normal user workflows.

## Scope
- Remove chat rendering that branches on mock message id `m10`.
- Remove unused ChatMessage quote prop.
- Remove unreachable Similar Case inline expanded detail guarded by a fixed false value.
- Preserve Similar Case detail modal and required issue/chat/signature/summary/Knowledge flows.

## Acceptance Criteria
- Chat rendering does not depend on a mock message id.
- Similar case detail remains available through the modal.
- Required primary screens from `docs/UI_UX_SPEC.md` remain unchanged.
- No Knowledge DB, Import, or LLM contract behavior is deleted.

## 검증 절차
- `node scripts/rf-fip-product-slimming-smoke.mjs`
- `tsc --noEmit`
- `vite build`
- `node scripts/harness-policy-check.mjs`

## 금지사항
- Do not remove tabs or workflow buttons until the product owner explicitly chooses that stronger slimming scope.
- If Browser control is unavailable, record HTTP/build evidence and keep manual click-through as residual risk.

## Verdict
PASS
