# UI/UX Spec

## Primary Screens

- Issues: left issue list, center chat, right analysis panel
- Knowledge DB: case list, detail view, Signature Dictionary
- Import Review: candidate/hold list, candidate detail, original source modal

## Issue Creation

- Entry: left panel `+` icon button
- Required: title, model, band
- Optional: initial observation
- Success: issue is saved, selected, and visible in the list
- Failure: keep inputs and show toast

## Import Original View

- Entry: Import review candidate detail `원본 보기`
- Show: full raw text, source materials, first-pass result
- Must not truncate raw text inside the modal

## Required States

- Empty issue messages
- Disabled submit for invalid forms
- Save/API failure toast
- Confirmed DB registration state

## Accessibility

- Icon-only buttons need labels.
- Do not rely on color-only status.
- Modal close actions must be keyboard reachable.
