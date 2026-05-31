---
id: wiki-im-frequency-check
title: IM3 and IM5 Frequency Check
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: rf.ca_combo,rf.im_product,workflow.diagnostic_gate
signatureKeys: CA Combo,IM Product,Diagnostic Gate
version: 2026-05-31
updatedAt: 2026-05-31
owner: rf-domain
reviewDue: 2026-08-31
---

For CA or multi-carrier failures, calculate possible IM3 and IM5 products and compare them with the victim Rx channel. A channel-specific fail pattern is stronger when the calculated product overlaps the fail channel or filter skirt.

If the input lacks band combination, channel, Tx frequency, or Rx frequency, the next action should ask for a band/channel sweep and frequency calculation rather than state a final root cause.
