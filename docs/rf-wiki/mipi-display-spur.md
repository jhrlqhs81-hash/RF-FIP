---
id: wiki-mipi-display-spur
title: MIPI Display Spur Mapping
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: source.mipi_display,rf.spur,workflow.frequency_mapping
signatureKeys: MIPI,Display,Spur,Function ON/OFF
version: 2026-06-01
updatedAt: 2026-06-01
owner: rf-domain
reviewDue: 2026-09-01
---

MIPI display spurs should be checked when a narrow tone or channel-specific desense follows display ON/OFF, refresh rate, brightness, or MIPI clock changes. Map the spur frequency, compare display state changes, and test shielding, cable routing, and clock setting A/B.

The RCA should include whether the spur overlaps the victim channel, appears in conducted or OTA, and changes with display operating conditions.
