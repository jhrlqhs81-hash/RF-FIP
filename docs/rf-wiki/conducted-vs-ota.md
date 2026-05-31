---
id: wiki-conducted-vs-ota
title: Conducted Baseline vs OTA Path
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: test.conducted_result,test.ota_result
signatureKeys: Conducted Result,OTA Result
version: 2026-05-31
updatedAt: 2026-05-31
owner: rf-domain
reviewDue: 2026-08-31
---

Conducted RX baseline separates RF path performance from antenna, radiation, fixture, and mechanical coupling effects. If conducted sensitivity is normal but OTA TIS/EIS fails, prioritize antenna path, grounding, shielding, and mechanical contact checks.

If both conducted and OTA fail, prioritize RF chain, filter, LNA, Tx leakage, or internal noise coupling before blaming antenna structure. A valid RCA should state which baseline is known, missing, or still required.
