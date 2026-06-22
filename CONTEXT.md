# Nakafa Context

This glossary records stable domain terms used by Nakafa code and PR review. It is not an implementation plan.

## Learning Engagement

- **Canonical asset**: A material, question, article, or Quran asset owned by the content system. Other product surfaces group or navigate over references to these assets.
- **Learning context**: The verified page, placement, and tool policy facts available for one user interaction.
- **NinaContextPack**: The immutable learning context snapshot built before one Nina turn and stored on chat messages for replay.
- **Continue Learning**: A signed-in user read model ranked from recent learning interactions. It must not be inferred for anonymous users.
- **Popularity**: Aggregate learning interest derived from view events and durable counters. Product reads use bounded read models, not raw event scans.
- **Lifetime counter**: A durable popularity count that continues after raw audit events expire.
- **Integrity Module**: Permanent operational code that proves raw event coverage, checkpoint progress, lifetime counter inclusion, and rank-index consistency.

## Nina

- **NinaHarness**: The package-owned Effect service that owns AI SDK stream response composition, ToolLoopAgent orchestration, tool policy, repair, and writer callbacks.
- **Capability**: A Nina tool Module with schema, permission policy, execution, result normalization, and tests.
- **Capability policy**: The per-turn decision that returns Allowed, Denied, or NeedsConfirmation for a capability.
- **Pinned context**: The latest stored NinaContextPack reused when a continued chat is opened away from a verified learning asset.
- **Page fetch**: The one permitted current-page Nakafa content read for a verified learning page.
