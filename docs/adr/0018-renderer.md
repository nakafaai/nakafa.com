# ADR 0018: Nakafa Renders What Aksara Publishes, Under One Current Contract

## Decision

Authored MDX and its editorial rules live only in Aksara. Nakafa owns the
React renderer and renders exactly what the signed publication declares.

- Rendered content follows the audited Aksara locale equivalent without
  fallback. Renderer work preserves reviewed facts, pedagogy, exercises,
  renderer contracts, and the language being assessed.
- Learner-facing response labels arrive as rich Markdown strings. Plain text
  and prose mixed with math render through the canonical design-system
  Markdown surface, with no-space `$$...$$` for inline math and a fenced
  `math` block for display math. There is no text-versus-math union,
  response-content AST, or second label renderer.
- Lesson and article bodies use only `h2` and `h3`, lesson exercises and
  worked solutions included. Standalone question-bank answers render below an
  app-owned `h3`, so only those authored answer sections begin at `h4` and may
  use `h5` for real nesting.
- Math uses `InlineMath` and `BlockMath`, `MathContainer` for consecutive
  blocks, and the published `NumberLine` and `LineEquation` component names.
  Renderer code imports the owning implementation directly; authored MDX has
  no renderer imports.
- Renderer declarations and artifact requirements use component names with one
  current implementation and component set. There are no component or
  renderer contract version fields, dual registries, or compatibility
  adapters for additive props.

## Consequences

- Deploy the matching renderer before publishing content that uses it.
- Preserve compiler provenance, hashes, signatures, and immutable snapshot
  identities.
- Before removing a renderer name, verify the active signed corpus and the
  retained inverse in both development and production. Repository source and
  production alone cannot prove development has migrated. Keep the
  implementation through paired publication and acceptance, and remove it only
  after every active artifact's requirements exclude it.

## Rejected Alternative

Versioned renderer contracts and compatibility adapters keep two
implementations alive and let published content drift from the renderer that
was reviewed with it.
