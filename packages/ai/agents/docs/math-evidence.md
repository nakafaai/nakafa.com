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

## Contracts

- Calculus requests use calculus before arithmetic simplification.
- Bounded integrals are described as definite or improper integrals, never
  indefinite integrals.
- Partial evidence can support a result only when the answer names the theorem
  or transformation that supplies the missing derivation.
- A later arithmetic check verifies only the simplification it actually checked.
- Fair dice, cards, and finite equally likely outcomes use statistics mean or
  arithmetic over the outcome list instead of the named-distribution tool.

## References

- AI SDK tools: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Effect services: https://effect.website/docs/requirements-management/services/
