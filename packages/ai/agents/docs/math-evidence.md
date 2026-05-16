# Math Evidence Scope

Nina's math agent separates deterministic tool status from derivation scope.

```mermaid
flowchart TD
  User["User asks math question"] --> Route["Nina math tool"]
  Route --> Original["check original target operation first"]
  Original --> Evidence{"stepStatus"}
  Evidence -->|complete| Complete["answer may say the checked result is verified"]
  Evidence -->|partial| Partial["answer must say deterministic evidence is limited"]
  Evidence -->|unavailable| Missing["answer must say the evidence is insufficient"]
  Partial --> Optional["optional follow-up check"]
  Optional --> Simplify["verify only the follow-up simplification"]
```

Probability is one model-facing tool. Event-specific requirements stay behind
the Effect schema and CAS adapter so the prompt stays small while validation
remains strict.

```mermaid
flowchart TD
  Prompt["math prompt"] --> Tool["probability tool"]
  Tool --> Operation{"operation"}
  Operation --> Summary["distribution / expected value / variance"]
  Operation --> Point["point needs point"]
  Operation --> Cumulative["cumulative needs upper"]
  Operation --> Tail["tail needs lower"]
  Operation --> Interval["interval needs lower + upper"]
  Summary --> Effect["Effect schema validation"]
  Point --> Effect
  Cumulative --> Effect
  Tail --> Effect
  Interval --> Effect
  Effect --> CAS["CAS probability handler"]
```

The math package keeps schema ownership in focused modules instead of a single
large file. Callers import the exact schema they use; there is no `schema.ts`
barrel.

```mermaid
flowchart TD
  Shared["schema/shared"] --> Tools["schema/tool/*"]
  Operations["schema/operations"] --> ToolInput["schema/tool-input"]
  Tools --> ToolInput
  Shared --> Request["schema/request"]
  Operations --> Request
  Request --> Result["schema/result"]
  Shared --> Result
  Result --> Data["schema/data"]
  Request --> Data
```

## Contracts

- Calculus requests use calculus before arithmetic simplification.
- Bounded integrals are described as definite or improper integrals, never
  indefinite integrals.
- Math schema imports are concrete module imports such as
  `@repo/math/schema/tool/probability`; `@repo/math/schema` is not a public
  compatibility barrel.
- Named probability distributions use one `probability` tool. The selected
  operation carries the event shape instead of exposing separate tool names for
  point, cumulative, tail, and interval probabilities.
- Partial evidence can support a result only when the answer names the theorem
  or transformation that supplies the missing derivation.
- A later arithmetic check verifies only the simplification it actually checked.
- Fair dice, cards, and finite equally likely outcomes use statistics mean or
  arithmetic over the outcome list instead of the named-distribution tool.

## References

- AI SDK tools: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- AI SDK prompt engineering: https://ai-sdk.dev/docs/ai-sdk-core/prompt-engineering
- Effect services: https://effect.website/docs/requirements-management/services/
