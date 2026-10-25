# ADR 0018: Nakafa Renders What Aksara Publishes, Under One Current Contract

## Decision

Authored MDX and its editorial rules live only in Aksara. Nakafa owns the
React renderer and renders exactly what a signed Aksara publication declares.
That statement covers Aksara publications only: a school's own items are not
signed and are in no publication, and the last point below says how they render.

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
- Assessment items, the try-out and school exam items of ADR 0031, are not MDX
  code. Their body is an assessment document: a structured tree of paragraphs,
  headings, lists, tables, math written in LaTeX with MathML, and figures. A
  figure is one of the published components (`MathVisual`, `NumberLine`,
  `LineEquation`, `UnitCircle`, `Mermaid`) or an image with alternative text. ADR
  0031 says how the other figure kinds of the corpus migrate. Aksara still
  writes MDX, and its compiler produces the document. The renderer draws the
  document and runs no authored code. Nakafa items and school items share this
  renderer, and it carries no version field. Program wave A (the first School
  delivery wave) builds the contract, the compiler, and this renderer. The
  player that uses them is wave B.
- The content generation moves once, from the retired Aksara 0.51 compiled-body
  format (`mdx-function-body`) to the content tree (`content-tree`), and never
  back. Nakafa owns that transition. A candidate may replace the retired
  generation only as a bootstrap, and Nakafa decides that from its stored state
  and the signed counts, never from what the publisher declares. It must extend
  the active release, that release must be recorded under the retired
  generation, its result must hold only upserted heads (`resultCount` equals
  `upsertCount`), every snapshot family must be replaced or empty, and no
  recovery may be staged. A bootstrap activates with no retained inverse and
  records the content tree generation. Accept and recover refuse it. Every
  other candidate or recovery over the retired generation is refused at staging
  and again at activation, so no retired head survives the switch. Nothing may
  stage or activate over an active release whose generation is not recorded.

## Consequences

- Deploy the matching renderer before publishing content that uses it.
- Preserve compiler provenance, hashes, signatures, and immutable snapshot
  identities.
- Before removing a renderer name, verify the active signed corpus and the
  retained inverse in both development and production. Repository source and
  production alone cannot prove development has migrated. Keep the
  implementation through paired publication and acceptance, and remove it only
  after every active artifact's requirements exclude it.
- The publication state records the generation of its active release, and
  every activation records the current one. On 25 Oct 2026 a one-off migration
  recorded the retired generation on dev and on production, each after reading a
  stored artifact of its active release in the retired format; it was then
  removed with its tests. A later generation change records its retired
  generation the same way.
- The undo of the bootstrap is a forward release of the last 0.51-era source,
  not a restore. The publication state cannot return to the retired generation.

## Rejected Alternative

Versioned renderer contracts and compatibility adapters keep two
implementations alive and let published content drift from the renderer that
was reviewed with it.

A retained inverse across the generation switch, or a reader that still
decodes retired bodies, is rejected too. The retired bodies do not decode under
the current contract, and an inverse would restore content that no current
reader can render.
