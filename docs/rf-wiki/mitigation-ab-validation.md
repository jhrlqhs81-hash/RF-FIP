---
id: wiki-mitigation-ab-validation
title: Mitigation A/B Validation
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: workflow.mitigation_validation,workflow.ab_test,workflow.rca_gate
signatureKeys: Mitigation,Validation,A/B Test,Corrective Action
version: 2026-06-01
updatedAt: 2026-06-01
owner: rf-domain
reviewDue: 2026-09-01
---

Mitigation A/B validation should prove that a corrective action changes the suspected mechanism and not only the symptom. Compare before and after units, repeat across samples, preserve the original fail condition, and record whether the fix affects conducted, OTA, spectrum, or mechanical sensitivity evidence.

An RCA should not close on mitigation text alone. It needs repeatable A/B evidence, residual risk, and a reason why competing hypotheses are less likely.
