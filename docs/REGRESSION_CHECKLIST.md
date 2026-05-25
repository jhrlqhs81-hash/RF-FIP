# Regression Checklist

Check this before marking a phase complete.

## Product Regression

- Does the change still support RF desense RCA workflow?
- Does it preserve Issue -> Chat -> Signature -> RCA -> Knowledge DB flow?
- Does it avoid turning the app into a generic chat UI?

## Architecture Regression

- Are API contracts in `API_CONTRACTS.md` still valid?
- Is storage still server-owned?
- Are runtime DB/log/build artifacts ignored?

## UI Regression

- Can a user recover from save/import failure?
- Are required form states disabled when invalid?
- Are original source materials still inspectable?

## Domain Regression

- Are RF signatures preserved during import/save?
- Are conducted/OTA/PIM/Internal clues not dropped?

## Verification Regression

- Did typecheck/build run after code changes?
- Did smoke tests avoid real user DB?
