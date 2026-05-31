---
id: wiki-lna-rf-chain-conducted-fail
title: LNA and RF Chain Conducted Fail
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: rf.lna_chain,rf.conducted_fail,workflow.diagnostic_gate
signatureKeys: LNA,RF Chain,Conducted Result,Gain Step
version: 2026-06-01
updatedAt: 2026-06-01
owner: rf-domain
reviewDue: 2026-09-01
---

If conducted RX sensitivity fails, prioritize RF chain issues before antenna-only hypotheses. Check LNA gain state, switch path, filter loss, solder, component damage, calibration state, and conducted path repeatability across bands and gain steps.

OTA failure can still coexist, but a conducted fail means the receiver chain or RF front-end must be cleared before blaming chamber, antenna, or mechanical radiation path.
