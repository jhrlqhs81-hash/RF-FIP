# Signature Ontology

RF-FIP Signature는 저장 호환성을 위해 기존 `{ key, value, isNew? }` 형태를 유지합니다. Local Engine은 그 위에 `SignatureConceptRegistry`를 적용해 key 계층, value 단순화, 동의어, 관계 규칙을 해석합니다.

## Goal

- `BackGlass`, `back glass`, `백글라스`, `백글`처럼 같은 의미의 용어를 하나의 canonical signature로 정규화합니다.
- key를 `domain -> concept -> value` 수준으로 계층화해 운영 난이도를 낮춥니다.
- signature 간 관계를 missing checklist, 유사사례 검색, 가설 우선순위에 활용합니다.
- 기존 Knowledge DB와 Issue 저장 구조를 깨지 않습니다.

## Non Goals

- 이번 구조는 DB schema migration이 아닙니다.
- LLM이 임의로 concept을 추가하지 않습니다.
- pending/near-match 용어는 자동 승인하지 않습니다.
- UI를 새로 추가하지 않습니다.

## Concept Shape

```ts
SignatureConcept {
  id: "mechanical.contact_structure",
  parentId: "mechanical",
  domain: "mechanical",
  displayKey: "Contact Structure",
  keyAliases: ["Structure", "Contact Type"],
  valueType: "enum",
  values: [
    {
      id: "back_glass",
      displayValue: "Back Glass",
      aliases: ["BackGlass", "back glass", "백글라스", "백글"]
    }
  ],
  relations: [
    {
      type: "requires",
      targetConceptId: "mechanical.pressure_sensitive",
      targetKey: "Pressure Sensitive",
      missingInfo: "Pressure A/B test result"
    }
  ]
}
```

## Hierarchy Rule

권장 계층은 최대 3단계입니다.

```text
domain -> concept -> value
mechanical -> contact_structure -> back_glass
rf -> im_product -> im3
test -> conducted_result -> normal
source -> noise_source -> pmic_dcdc
workflow -> diagnostic_gate -> pressure_ab
```

3단계를 넘기면 관리자 운영, weight 설정, LLM context 설명이 복잡해지므로 별도 ADR 없이 확장하지 않습니다.

## Relation Types

- `requires`: source signature가 있으면 target evidence가 필요합니다.
- `boosts`: source signature가 있으면 target hypothesis나 category 우선순위를 올립니다.
- `conflicts`: 두 signature가 같이 있으면 모순 가능성을 표시합니다.
- `coOccurs`: 같이 자주 등장하는 signature를 유사사례 검색 보정에 사용합니다.
- `blocksConclusion`: target evidence 전까지 RCA 확정을 막습니다.

현재 구현은 `requires`, `boosts`, `coOccurs`를 LocalEvidencePacket의 relation hint와 missing checklist에 우선 연결합니다.

## Synonym Dictionary Rule

- approved alias만 자동 canonicalize합니다.
- pending 후보는 `pendingAliasCandidates`로 보존하되 자동 매핑하지 않습니다.
- 한 term이 여러 concept에 매칭될 수 있으면 자동 승인하지 않습니다.
- raw input은 evidence로 남기고 canonical value만 저장/검색에 사용합니다.
- Built-in alias는 `SignatureConceptRegistry`에서 파생하고, 사용자 승인 alias는 `signatureAliasDictionary` persisted overlay로 병합합니다.
- LLM이나 Import가 제안한 alias는 `pending` 상태로만 보관하며, 사용자가 승인하기 전까지 Chat/Import/Similarity 결과에 영향을 주지 않습니다.

## 운영 적용 범위

- 저장 호환성은 `SignatureTag { key, value }`로 유지합니다.
- Local Engine 내부 비교/검색/가중치/LLM context는 `conceptId`, `valueId`, `domain`, `conceptPath`를 우선 사용합니다.
- `Contact Type`, `Structure`, `Suspected Structure`처럼 같은 개념의 key alias는 `mechanical.contact_structure`로 묶습니다.
- `BackGlass`, `백글`, `rear cover glass`처럼 같은 값 표현은 `back_glass` value id로 단순화합니다.
- Weight rule은 운영자가 보던 display key를 유지하지만, lookup은 concept key 기준으로 수행합니다.
- LLM context에는 raw key/value와 canonical key/value, concept id/value id를 함께 제공해 중복 signature 생성을 줄입니다.

## Usage

- Chat signature extraction: `extractRfSignatures()`
- Import/local facts: `buildLocalEvidencePacket()`
- Knowledge DB similarity: `calcSimilarity()`
- LLM shared context: canonicalized signatures and weighted context
- Missing checklist: concept relation `requires`

## Verification

```powershell
node scripts/rf-fip-signature-concept-ontology-smoke.mjs
node scripts/rf-fip-signature-hierarchy-smoke.mjs
node scripts/rf-fip-signature-alias-resolver-smoke.mjs
node scripts/rf-fip-signature-alias-dictionary-smoke.mjs
node scripts/rf-fip-signature-weights-smoke.mjs
node scripts/harness-policy-check.mjs
git diff --check
```
