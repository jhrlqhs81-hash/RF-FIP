# Import Spec

## Supported Inputs

- CSV
- TSV
- JSON
- TXT/MD
- Excel `.xlsx/.xls` after parser phase
- Image/file metadata only until OCR/Gauss support exists

## Candidate Split

- Header-based tabular files split row-by-row.
- TXT/MD splits on case boundaries, numbered sections, or separators.
- JSON arrays split item-by-item.

## First-Pass Filter

- Candidate when RF keywords or at least two useful signatures are found.
- Hold when RF evidence is insufficient.
- Hold candidates must be reviewable and later editable.

## Original Source

- Preserve `rawText` separately from truncated `previewText`.
- Show source table/image/file/url metadata in original view modal.

## Duplicate Detection

- Current baseline: normalized title + band + root cause.
- Target: Signature similarity plus root-cause/title fallback.
