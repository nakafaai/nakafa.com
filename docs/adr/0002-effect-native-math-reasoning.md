# ADR 0002: Effect-native MathReasoning Replacement

## Status

Accepted.

## Context

Nina math needs to answer pedagogically for learners from beginner level through
professor-level use while staying deterministic-first, verifiable, scalable, and
easy to evolve. The existing math path is split across AI tool orchestration,
`data-math` message parts, CAS transport results, chat rendering, and manually
mirrored persistence shapes. Preserving that path would keep math semantics spread
across shallow modules and make future Wolfram-style workspaces, durable evidence,
and 3D visual intent harder to evolve safely.

## Decision

Nakafa will replace the current math tool/data-math path with a deep
`MathReasoning` Module owned by `packages/math`. Its external Interface is a small
Effect-native `produceWork` operation that returns canonical `MathWork` evidence:
assumptions, computations, semantic `MathWorkStep` derivations, verification
lanes, pedagogical projections, compact `MathWorkArtifact` manifests, and
`VisualIntent`.

TypeScript Effect Schema owns the public math domain contracts. Python Pydantic
remains only the `apps/cas` transport Adapter contract for the live SymPy engine.
`packages/ai` calls `MathReasoning` from Nina as a LearningCapability instead of
owning math reasoning. `apps/www` renders TSX-only MathWork projections.
`packages/backend/convex` persists normalized, indexed, bounded math evidence with
server-side authorization.

Canonical `MathWork`, Convex evidence rows, and math UI render manifests store
semantic keys and values rather than learner-facing prose. Student-visible copy is
resolved through `packages/internationalization` in the app projection seam for
Indonesian and English. Internal LLM prompt instructions may stay in English only
inside AI-owned prompt Adapters, and they must not be rendered in the UI, persisted
as learner evidence, or shared with the app dictionaries.

The implementation must be a clean replacement, not a compatibility layer. Do not
keep permanent old/new dual paths, public backcompat wrappers, chat-renderer
semantic workarounds, duplicate schema sources, or legacy leftovers. If existing
production data requires a migration, the migration must be bounded, proven, and
removed when the old path is no longer needed.

The first implementation worker should run in strict replacement mode: it may
delete broken math seams, the old `data-math` flow, redundant tests, duplicate
contracts, stale wrappers, and dead folders once `MathReasoning` owns the behavior
with tests and runtime proof. Partial compatibility bridges must not survive the
pull request.

## Consequences

- Math callers and tests cross one deep Module Interface instead of coordinating
  CAS, pedagogy, persistence, and rendering themselves.
- Effect programs compose internally with typed errors and dependency requirements;
  `Effect.runPromise` and `Effect.runSync` stay at framework, CLI, or test
  boundaries.
- The first vertical slice covers algebra/equation solving,
  simplification/factoring, derivative/integral basics, and coordinate
  line/circle `VisualIntent`.
- Convex stores normalized `MathWork`, paginated `MathWorkStep`, and compact
  `MathWorkArtifact` data rather than raw transcript math blobs.
- Student-facing math UI copy uses clear learner or teacher language, not internal
  labels such as engine, operation, verification lane, or MathReasoning status.
- AI prompt copy is an Adapter concern and remains separate from localized UI
  dictionaries so prompt instructions cannot leak into student-facing math views.
- File and folder names in the new math architecture should be short,
  domain-owned names, preferably one word where clear, with TS-only domain folders
  separate from TSX-only renderer folders.
- Production readiness requires deleting the replaced math path and proving the
  new architecture through local quality gates, Convex dev and production
  evidence, and any deployment/runtime evidence explicitly authorized for the
  implementation. Vercel deployment must not be performed unless separately
  authorized.
- Pull request readiness requires current GitHub evidence: up-to-date branch,
  current proof matrix, green required checks, verified review threads, and no
  unresolved valid review feedback. Automated or Codex-authored review comments
  must be checked against the code before acting on or dismissing them. Invalid
  review comments get one concise evidence-backed reply instead of a workaround
  patch or a long argument.
- Production-readiness proof includes `pnpm format`, `pnpm build`, root
  `pnpm start`, Browser proof through the real authenticated app session, hardcoded
  copy scans, JSDoc scans, and LOC proof for touched handwritten TypeScript and TSX.
