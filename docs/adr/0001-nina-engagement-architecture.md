# ADR 0001: Single NinaHarness with Internal LearningCapabilities and Production Evals

## Status

Accepted for PR #187.

## Context

Nina needs durable learning context, AI SDK streaming, deterministic education
tools, bounded operational traces, and production evals without exposing AI SDK
callback shapes through app routes. Learning engagement also needs Continue
Learning and popularity reads that stay bounded as raw view volume grows.

## Decision

Nakafa uses one package-owned `NinaHarness` Effect service with a single external
`stream` Interface. The Next route remains the HTTP/auth boundary and binds
app-owned adapters for Convex persistence, diagnostics, and Nakafa content/search
services.

ToolLoopAgent, `prepareStep`, repair, writer callbacks, model selection,
LearningCapability policy, evidence envelopes, trace summaries, and AI SDK UI
stream response composition stay internal to `packages/ai/nina`.

Math, Nakafa, and research are internal LearningCapabilities. They return
schema-derived evidence instead of owning public app contracts. Math is
deterministic-first; Nakafa owns Nakafa content evidence; research is reserved for
source-heavy, current, or external work.

Production evals use schema-derived EvalCases, EvalSuites, and EvalRuns over
NinaHarness and LearningCapability seams. Provider-backed evals are opt-in for
provider behavior changes; deterministic suites are the default readiness gate.

Learning engagement uses durable read models and counters for product reads. Raw
learning view events are bounded audit data after integrity proof. Lifetime
popularity is stored in durable counters/checkpoints, with Aggregate reserved for
ranked read indexes where it simplifies bounded top-N reads.

## Consequences

- Routes do not own AI SDK callback, tool-loop, or capability contracts.
- Product contracts derive from Effect Schema, generated Convex types, AI SDK
  interop types, or Effect services instead of duplicated TypeScript shapes.
- LearningCapability traces are bounded operational data, not canonical chat
  transcripts.
- App adapters can change deployment details without changing NinaHarness.
- Popularity cleanup cannot happen until the Integrity Module proves raw
  coverage, checkpoint progress, lifetime inclusion, and rank-index consistency.
