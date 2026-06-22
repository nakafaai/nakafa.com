# ADR 0001: Nina Harness and Engagement Read Models

## Status

Accepted for PR #187.

## Context

Nina needs durable learning context, AI SDK streaming, specialist tools, and message persistence without exposing AI SDK callback shapes through app routes. Learning engagement also needs Continue Learning and popularity reads that remain bounded as raw view volume grows.

## Decision

Nakafa uses a package-owned `NinaHarness` Effect service with one external `stream` Interface. The Next route remains the HTTP/auth boundary and binds app-owned adapters for Convex persistence, reporting, and Nakafa search/content services. ToolLoopAgent, prepareStep, repair, writer callbacks, model selection, capability policy, and AI SDK UI stream response composition stay internal to `packages/ai/nina`.

Learning engagement uses durable read models and counters for product reads. Raw learning view events are bounded audit data after integrity proof. Lifetime popularity is stored in durable counters/checkpoints, with Aggregate reserved for ranked read indexes where it simplifies bounded top-N reads.

## Consequences

- Routes are thinner and no longer own AI SDK callback or tool-loop contracts.
- Product contracts derive from Effect Schema, generated Convex types, or AI SDK interop types instead of duplicated TypeScript shapes.
- App adapters can change deployment details without changing Nina's harness Interface.
- Popularity cleanup cannot happen until the Integrity Module proves raw coverage, checkpoint progress, lifetime inclusion, and rank-index consistency.
