---
id: wiki-antenna-feed-matching
title: Antenna Feed and Matching Check
sourceType: local-public
securityClass: public-safe
allowedProviders: local,openai,gauss
conceptIds: antenna.feed_path,antenna.matching,workflow.diagnostic_gate
signatureKeys: Antenna Feed,Matching Network,Return Loss,VSWR,Diagnostic Gate
version: 2026-06-01
updatedAt: 2026-06-01
owner: rf-domain
reviewDue: 2026-09-01
---

Antenna feed and matching issues are likely when OTA sensitivity degrades while conducted RX remains normal, especially after feed point rework, matching component change, solder crack, or antenna path assembly change. Useful checks include return loss, VSWR, antenna current distribution, matching component inspection, and before/after comparison of the feed trace and connector.

Do not conclude antenna matching from OTA loss alone. Keep conducted baseline, chamber repeatability, and mechanical assembly state visible in the RCA before naming feed or matching as root cause.
