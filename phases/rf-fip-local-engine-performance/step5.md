# Step 5: single-evidence-packet-source

## 읽어야 할 파일

- `docs/README.md`
- `docs/TEST_PLAN.md`
- `docs/AI_ROLE_CHECKLIST.md`
- `client/src/lib/localRfAnalyzer.ts`
- `scripts/rf-fip-evidence-packet-smoke.mjs`

## 작업

Make `generateLocalRfReply()` use `buildLocalEvidencePacket()` as the single Local Engine analysis source.

## Scope

- Derive reply extracted tags, classification, rationale, diagnostic tests, missing info, and similar cases from the evidence packet.
- Strengthen evidence smoke coverage so reply output and evidence packet stay aligned.
- Keep user-visible response shape unchanged.

## Acceptance Criteria

- Chat reply and evidence packet expose the same extracted signatures.
- Reply content includes the evidence packet classification.
- Local Engine related smoke checks pass.
- TypeScript, Vite build, server bundle, harness policy, and whitespace checks pass.

## 검증 절차

- `_analysis_rf_platform_ux\node_modules\.bin\tsc.cmd -p _analysis_rf_platform_ux\tsconfig.json --noEmit`
- `node _analysis_rf_platform_ux\scripts\rf-fip-evidence-packet-smoke.mjs`
- `node _analysis_rf_platform_ux\scripts\rf-fip-local-engine-performance-smoke.mjs`
- `node _analysis_rf_platform_ux\scripts\rf-fip-hardcode-consolidation-smoke.mjs`
- `node _analysis_rf_platform_ux\scripts\rf-fip-signature-concept-ontology-smoke.mjs`
- `_analysis_rf_platform_ux\node_modules\.bin\vite.cmd build --config _analysis_rf_platform_ux\vite.config.ts`
- `_analysis_rf_platform_ux\node_modules\.bin\esbuild.cmd _analysis_rf_platform_ux\server\index.ts --platform=node --packages=external --bundle --format=esm --outdir=_analysis_rf_platform_ux\dist`
- `node _analysis_rf_platform_ux\scripts\harness-policy-check.mjs`
- `git -C _analysis_rf_platform_ux diff --check`

## 금지사항

- Do not change the chat UI contract in this step.
- Do not add NLP dependencies.
- Do not change RF taxonomy rules or Knowledge DB seed cases in this step.
- Do not push unless explicitly requested.

## Verdict

- Status: completed
- Verdict: PASS
- Evidence: typecheck, evidence smoke, local-engine performance smoke, hardcode consolidation smoke, signature concept smoke, Vite build, server bundle, harness policy, and diff whitespace checks passed.

## Notes

- This removes the expensive duplicate path where signature extraction, merge, taxonomy classification, and similar-case lookup were run once for reply text and again for the evidence packet.
- Residual cleanup remains: legacy RF taxonomy regex and seed Knowledge DB data are still hardcoded and should be handled in a separate phase.
