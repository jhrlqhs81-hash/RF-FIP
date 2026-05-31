---
id: wiki-internal-spur-function-on-off
title: Internal Spur Function ON/OFF A/B
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: source.noise_source,workflow.diagnostic_gate,rf.desense_type
signatureKeys: Noise Source,Diagnostic Gate,Desense Type
version: 2026-05-31
updatedAt: 2026-05-31
owner: rf-domain
reviewDue: 2026-08-31
---

Display, MIPI, camera, USB, DDR, PMIC, DC-DC, and charging clues should trigger function ON/OFF A/B testing and near-field or shielding checks. Narrow spurs are usually handled with frequency mapping; broadband noise needs noise floor comparison and shielding or source isolation.

The next analysis step should identify the suspected function, the ON/OFF condition, spectrum evidence, and whether the fail appears in conducted, OTA, or both paths.
