# RF Domain Spec

Primary taxonomy source: `../RF_DESENSE_TAXONOMY.md`.

## Core Concepts

- Desense Category
- Mechanism
- Tx Dependency
- PIM Risk
- Contact Structure
- Conducted Result
- OTA Result
- Diagnostic Gate

## Local Rule Expectations

- TX-induced cases should capture Tx power, band, IM/PIM clue, and conducted/OTA split when available.
- Internal desense cases should capture trigger source such as Display, MIPI, PMIC, DCDC, Camera, USB, DDR.
- Mechanical/contact cases should capture pressure, reassembly, contact type, drop, THB, or surface condition.

## Knowledge Case Quality

Each accepted KnowledgeCase should have:

- at least one band or RAT metadata field
- a root cause or hold reason
- diagnostic evidence
- mitigation/action guide
- source material linkage when imported
