# ADR 0001: Native Agent conversations with Confect domain operations

## Status

Accepted architecture for Nina and learning engagement.

## Context

Nina needs durable conversations, reconnectable streaming, verified learning
context, deterministic tools, and credit accounting. Next.js renders the product;
the backend owns conversation execution and persistence.

## Decision

`packages/backend/confect/nina` owns Nina. Confect specs declare validated public
and internal functions, and named Effect programs implement their behavior.
Generated database and runner services supply dependencies. Convex component SDK
calls use the generated context service at the SDK boundary.

A public mutation authenticates the learner, verifies page context, reserves
credits, saves the prompt through the Agent component, and schedules generation
in one transaction. A stable request key makes retries idempotent. The scheduled
action invokes Agent with a Vercel AI Gateway model. Lifecycle mutations settle
successful responses or refund failed and cancelled responses once.

The Agent component owns threads, messages, tool results, and stream deltas.
Application tables retain product ownership, visibility, credit transactions,
turn state, and learning context. They do not duplicate the Agent transcript.
React uses Confect hooks for application functions and the official Agent
`useUIMessages` hook for stream synchronization. Sending uses the official Agent
optimistic update contract. There is no Next.js AI transport route or separate AI
backend package.

Math, Nakafa retrieval, and external research are Agent tools implemented as
Effect programs. Specialist agents use the same Vercel Gateway provider and
Agent usage handler. Tool results retain progressive evidence cards and final
model-facing evidence. Context compaction changes provider input only; it does
not discard the stored transcript. Math uses deterministic computation, Nakafa
uses authenticated signed content, and research admits retrieved sources.

Expected generation failures become typed, stable reason codes. The application
dictionary owns user-facing copy and recovery guidance. Operational exception
reports carry bounded routing facts and redacted code frames. Optional product
analytics remains subject to account consent.

## Verification

Contract tests cover typed failures, credit reservation and settlement,
idempotency, ownership, uploads, context, and history migration. Agent integration
tests use the real component with controlled provider models. Local production
browser acceptance checks optimistic sending, reconnects, attachments, scrolling,
and stable layout. Provider-backed acceptance verifies the configured Gateway
separately from deterministic tests.

## Learning engagement

Continue Learning and popularity use durable read models with bounded reads.
Daily viewer keys expire after their UTC day. Daily signals remain through their
finite consumer windows, while lifetime counters remain durable. Retention
follows ADR 0008 and does not reconstruct lifetime totals from expired inputs.

## References

- https://confect.dev/v10/concepts/services
- https://confect.dev/v10/server/components
- https://confect.dev/v10/clients/react
- https://docs.convex.dev/agents/streaming
- https://docs.convex.dev/agents/messages#optimistic-updates-for-sending-messages
- https://docs.convex.dev/agents/usage-tracking
