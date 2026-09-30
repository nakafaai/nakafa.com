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

A committed final answer releases the chat immediately. The settlement mutation
also schedules optional title, follow-up, and summary generation exactly once
through Confect's Scheduler. That action rechecks the retained conversation and account,
and anchors its Agent context to the completed prompt so a newer turn cannot
change its suggestions. Optional generation never reserves or refunds credits.
The completion event records answer-time usage; the durable turn's usage and
token totals continue to include later presentation calls.

The Agent component owns threads, messages, tool results, and stream deltas.
Application tables retain product ownership, visibility, credit transactions,
turn state, and learning context. They do not duplicate the Agent transcript.
React uses Confect hooks for application functions and the official Agent
`useUIMessages` hook for stream synchronization. Sending uses the official Agent
optimistic update contract. There is no Next.js AI transport route or separate AI
backend package.

Nina's system prompt leads with stable instructions so provider prompt caching
reuses them across turns. The current page, a question focus, and per-turn
runtime facts follow in that order. On a verified learning page, generation
reads the signed page once before the first model step and places it in that
context within the page token budget. The model spends no forced tool step on
it and asks Nakafa for other sections.

Math, Nakafa retrieval, and external research are Agent tools implemented as
Effect programs. Specialist agents use the same Vercel Gateway provider and
Agent usage handler. Tool results retain progressive evidence cards and final
model-facing evidence, which never exceeds the evidence token budget: a
truncated output says what it omitted and how to ask for it, and Nakafa reads
continue by heading section. Context compaction changes provider input only; it does
not discard the stored transcript. Math uses deterministic computation, Nakafa
uses authenticated signed content, and research admits retrieved sources.

One collapsed Activity maps to one native `toolCallId`. Its children are the
capability's published evidence artifacts, not an exhaustive specialist trace.
Each specialist runs without the main thread ID, so its internal transcript does
not inflate the conversation. A typed failed or denied result retains already
published artifacts while keeping failure local to that activity. A failed child
does not mark a recovered parent or completed answer as failed.

A finished try-out review can ask Nina about one question. The browser sends
only the attempt and placement identities. Admission accepts the Question focus
only when the learner owns the attempt, the section is finished, and the plan
grants review answers, then stores the question order and section in the context
pack. Continued turns keep the focus while that entitlement holds and drop it
otherwise. Generation re-reads the signed question, the official explanation in
the learner's language, and the learner's recorded answer through an internal
query, so question text and answer keys never come from the client. The official
explanation is the source of truth for the answer.

Provider input keeps whole recent turns that the conversation summary does not
cover, newest first, within 12,000 tokens, and the current turn's evidence
within 16,000 tokens. Older evidence shortens with a visible note before a turn
is dropped, and no budget fails a turn. After a completed turn, the follow-up
action folds turns beyond the four newest into the chat's conversation summary
with a fast model once four such turns accumulate. The summary, at most 1,200
tokens, sits in the system prompt context and is deleted with its chat. Its
refreshes are chat upkeep, so their provider usage accumulates on the summary
rather than in a turn's usage ledger, which clients read. Old
reasoning is excluded from provider history; full conversation data stays in
Agent storage. External research admits at most
8 exact source URLs before provider work, with 3 concurrent fetches and 8,000
selected characters per source. Excess requests receive an explicit limit;
sources are never silently omitted. Public grounding sources are published for
zero, one, or multiple provider-reported queries without inventing query labels.

Convex deployments own `AI_GATEWAY_API_KEY`, `FIRECRAWL_API_KEY`,
`MATH_CAS_API_KEY`, and `NEXT_PUBLIC_CAS_URL`. The CAS key must match the
production CAS service, and its URL is `https://cas.nakafa.com`. These are
backend action configuration, not Next.js environment inputs. Resolve CAS
configuration before asking the math specialist to generate tool calls, so a
missing service cannot consume generation tokens or masquerade as checked work.
Release acceptance must run a real Agent math request and verify the stored
deterministic artifact, not only the answer's text.

Provider history includes calls only for currently registered capabilities.
The AI SDK prunes unavailable call/result pairs; validated evidence remains in
its original turn as compact text. The permanent Agent transcript is unchanged.
An individual tool failure displays a localized destructive-color row at the
failed capability or evidence item. It does not mark a completed answer as
failed. Response-level alerts are reserved for admission or generation failure.

Expected generation failures become typed, stable reason codes. The application
dictionary owns user-facing copy and recovery guidance. Operational exception
reports carry bounded routing facts and redacted code frames. Optional product
analytics remains subject to account consent.

## Verification

Contract tests cover typed failures, credit reservation and settlement,
idempotency, ownership, uploads, context, and retained conversation history. Agent integration
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
- https://confect.dev/v10/server/scheduling
- https://docs.convex.dev/agents/context
- https://docs.convex.dev/agents/streaming
- https://docs.convex.dev/agents/messages#optimistic-updates-for-sending-messages
- https://docs.convex.dev/agents/usage-tracking
