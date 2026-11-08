# ADR 0004: Curriculum Material Placement Context

## Status

Accepted for the curriculum-aware Continue Learning repair.

## Context

One canonical material asset can appear in several Learning programs and card
groups. Direct and SEO visits must keep the canonical material URL, while a
curriculum-origin visit must preserve the exact program and card group through
the material header, sibling navigation, analytics, and Continue Learning.

The frontend emitted the visible card-group key in `ctx`, but Convex tried to
match that key against the hidden material-leaf key. Those are intentionally
different identities, so every valid placement was stored as canonical.

## Decision

Keep the visible curriculum card group as the stable Material placement
identity. Project its ownership explicitly onto every curriculum material leaf:

- `materialContextNodeKey`
- `materialContextParentPath`
- `materialContextPublicPath`

The material leaf continues to own `materialKey`, `canonicalPath`, locale, and
program. Convex resolves a placement with one composite indexed lookup across
material key, locale, program key, and material-context node key. The lookup
must be unique and the leaf canonical path must still match the current
material lesson or topic.

The canonical material path remains the only public and SEO identity. `ctx` is
an optional validated query hint. Missing, invalid, stale, or ambiguous hints
resolve to canonical context without guessing from preferences, profiles,
asset identity, or program popularity.

Continue Learning uses latest-visit semantics. A curriculum visit stores its
verified Material placement; a later direct visit replaces it with canonical
context; a later different placement replaces it with that placement. Reads
revalidate stored placement against the current public-route projection so a
deleted or changed relationship cannot emit a stale contextual URL.

## Data Repair Rule

Historical repair is allowed only when exact signed-in pageview evidence
contains the full contextual URL and that placement resolves uniquely through
the current graph. The current row identity, canonical state, user, content,
and timestamp must still match before patching. Ambiguous, unmatched, stale,
or contextless histories remain canonical.

One-off repair functions are removed after guarded dev and production repair,
verification, and final deployment.

## Considered Options

- Infer the visible group by walking ancestors at read time: rejected because
  it duplicates source relationship logic in the hot database path.
- Add a separate material-placement table: rejected because the existing
  public-route leaf is already the durable projection and can own the relation
  without another sync lifecycle.
- Use the hidden material-leaf key in URLs: rejected because it couples the
  interaction contract to projection-only leaf identity and breaks the stable
  visible group contract.
- Keep legacy context modes or compatibility readers: rejected because no live
  rows use them and they do not solve Material placement identity.

## Consequences

- Static curriculum cards and Convex share one source-owned placement contract.
- Context verification is bounded, indexed, and exact.
- Canonical SEO behavior remains unchanged.
- Curriculum-origin resume behavior survives current source changes only while
  its exact relation remains valid.
- Try-out attempts remain independent and continue to use immutable attempt
  snapshots rather than Material placement.
