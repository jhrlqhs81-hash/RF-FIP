# RAG Contract

RF-FIP RAG는 판단 엔진이 아니라 reference evidence provider입니다. 사용자 입력, 첨부자료, `LocalEvidencePacket`이 항상 source of truth입니다.

## Source Tiers

| Source type | Security class | Providers | Status |
| --- | --- | --- | --- |
| `local-public` | `public-safe` | `local`, `openai`, `gauss` | Enabled from local markdown files |
| `local-internal` | `internal-only` | `local`, `gauss` | Contract only until an internal source is configured |
| `knowledge-case-excerpt` | `internal-only` by default | `local`, `gauss` | Enabled from persisted `confirmed` Knowledge DB cases |
| `gauss-internal-wiki` | `internal-only` or `restricted` | `gauss` | Blocked outside the internal PC/Gauss environment |

## RagSnippet Shape

```ts
interface RagSnippet {
  id: string;
  title: string;
  sourceType: "local-public" | "local-internal" | "gauss-internal-wiki" | "knowledge-case-excerpt";
  securityClass: "public-safe" | "internal-only" | "restricted";
  allowedProviders: Array<"local" | "openai" | "gauss">;
  matchedConceptIds: string[];
  matchedSignatureKeys: string[];
  score: number;
  excerpt: string;
  sourcePath?: string;
  sourceUrl?: string;
  version?: string;
  updatedAt?: string;
  owner?: string;
  reviewDue?: string;
  deprecated?: boolean;
  sourceCaseId?: string;
  sourceKind?: "wiki" | "knowledge-case-excerpt";
  sourceStatus?: string;
}
```

`sourceType` also accepts `"knowledge-case-excerpt"` for confirmed Knowledge DB case excerpts. Those snippets use `sourceCaseId` to point back to the persisted case and keep `sourceStatus: "confirmed"`.

## Maintenance Metadata

Every `docs/rf-wiki/*.md` document must include frontmatter with:

- `id`: stable wiki source id used in `usedWikiSourceIds`
- `title`: human-readable title
- `sourceType`: currently `local-public` only until internal Wiki contract is supplied
- `securityClass`: currently `public-safe` for OpenAI-eligible local seed documents
- `allowedProviders`: explicit provider allow-list
- `conceptIds`: concept-level retrieval hints
- `signatureKeys`: signature-level retrieval hints
- `version`: document version date or semantic version
- `updatedAt`: last content review/update date in `YYYY-MM-DD`
- `owner`: accountable domain owner
- `reviewDue`: next required review date in `YYYY-MM-DD`

The maintenance smoke fails when metadata is missing, ids duplicate, OpenAI receives non-public snippets, or `reviewDue` is stale.

## Golden Query Regression

RAG retrieval quality is guarded with deterministic golden queries for:

- Tx/contact/pressure clues
- conducted-vs-OTA separation
- CA IM3/IM5 frequency calculation
- function ON/OFF spur isolation
- antenna/feed/matching issues
- mechanical/contact/assembly issues
- internal spur/noise issues
- conducted/RF-chain fail issues
- chamber/fixture validation issues
- mitigation A/B validation issues

Adding or editing wiki documents should update the golden query smoke when the expected retrieval target intentionally changes.

## Public RF Wiki Expansion Policy

Public RF Wiki expansion stays markdown-based until the corpus is large enough to justify a separate search service. The current gate requires at least 20 public-safe RF Wiki documents, complete maintenance metadata, non-stale `reviewDue`, provider allow-listing, and golden query coverage.

Do not add vector DB, BM25 dependency, or external search service for this corpus size. Add new public RF Wiki documents with deterministic `conceptIds` and `signatureKeys` first. Revisit hybrid/vector search only when document count, document length, or observed recall failures make metadata-based retrieval insufficient.

## Knowledge DB RAG Excerpts

Knowledge DB RAG uses server-generated excerpts, not raw case records. The first implementation reads only persisted server Knowledge cases and only `status: "confirmed"` cases become `knowledge-case-excerpt` sources.

Excerpt content may include:

- symptom pattern
- decisive evidence from `decisionRationale`
- confirmed root cause
- diagnostic tests
- mitigation
- lessons learned
- signatures

Excerpt content must not include raw attachments, attachment URLs, issue thread messages, user names, assignee metadata, or model/internal project metadata. `validated` cases are excluded from RAG even if they remain visible in Knowledge DB or similarity search.

Knowledge case excerpts default to `securityClass: "internal-only"` and `allowedProviders: local, gauss`. OpenAI must not receive them unless a future explicit public-safe promotion policy is added.

## Provider Filtering

- `openai`: only `securityClass=public-safe` and `allowedProviders` includes `openai`.
- `gauss`: `public-safe` and internal snippets are allowed only if `allowedProviders` includes `gauss`.
- `local`: may use local public snippets and internal Knowledge case excerpts; it must not call external providers.
- Filtered snippets are not sent to the provider.
- Blocked internal wiki connectors must report missing contract items without exposing secret values.

## Alias Relation Query Expansion

RAG may use persisted approved `signatureAliasDictionary` entries for deterministic query expansion before scoring documents. This expansion is retrieval-only and does not canonicalize Chat, Import, Knowledge DB, or Similarity signatures.

- `synonym`, `alias`, `abbreviation`, `translation`, `spelling_variant`, and `semantic_alias` may expand query terms.
- `related_to`, `caused_by`, `measured_by`, `parent_of`, and `condition_of` may also expand query terms, but remain non-canonicalizing relation metadata.
- `reject` and `pending` entries must not expand query terms.
- Provider/security filtering still applies after expansion; OpenAI must still receive only `public-safe` snippets.
- `retrievedKnowledgeContext.expandedQueryTerms` records added normalized query terms for audit/debug.

## LLM Input Contract

```ts
{
  retrievedKnowledgeContext: {
    policy: {
      sourceOfTruth: "localEvidencePacket",
      referenceOnly: true,
      providerFiltered: true
    },
    snippets: RagSnippet[],
    filteredCount: number,
    blockedReasons: string[]
  }
}
```

## Rules

- RAG snippets cannot create measurements, pass/fail results, root cause, or evidence IDs.
- LLM output should cite wiki `id` values in `usedWikiSourceIds` and Knowledge case excerpt ids in `usedKnowledgeCaseSourceIds` when it uses RAG material.
- `chat-reply` and `rca-summary` use RAG in the first implementation.
- `import-classify`, `signature-normalize`, `attachment-analysis`, and hypothesis generation stay contract-only until separately approved.
