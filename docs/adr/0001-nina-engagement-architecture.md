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
action invokes Agent with a Convex AI gateway model. Lifecycle mutations settle
successful responses or refund failed and cancelled responses once.

A committed final answer releases the chat immediately. The settlement mutation
also schedules optional title, follow-up, and summary generation exactly once
through Confect's Scheduler. That action rechecks the retained conversation and account,
and anchors its Agent context to the completed prompt so a newer turn cannot
change its suggestions. Optional generation never reserves or refunds credits.
The completion event records answer-time usage; the durable turn's usage and
token totals continue to include later presentation calls. The title and the
summary text are stored sealed for the learner who owns the chat; the migration
that sealed every row still holding plain text ran on 11 October 2026, on dev
and production, and was then deleted. Message text is the private text that is
still stored plain: [ADR 0024](./0024-messages.md) decides how it is sealed.

The Agent component owns threads, messages, tool results, and stream deltas.
Application tables retain product ownership, visibility, credit transactions,
turn state, and learning context. They do not duplicate the Agent transcript.
React uses Confect hooks for application functions and the official Agent
`useUIMessages` hook for stream synchronization. Sending uses the official Agent
optimistic update contract. There is no Next.js AI transport route or separate AI
backend package.

A public chat is shared by link, and the link holds a share token, not only the
chat id. Turning sharing on draws 32 random bytes and stores their SHA-256 hash,
which readers check without any key, and the token sealed for the owner, so the
owner can copy the link again. The link carries the token in its fragment, which
a browser sends to no server, so opening the link leaves the token in no request
log, and the analytics client drops fragments from every URL it reports. Three
flows read the address of the current page and send it on, and none of them
carries the token. The language switch asks Nakafa's server for the other
language of the path and the query, keeps the fragment in the browser and puts
it back on the answer. The return address of a checkout, which goes to Polar,
and the return address of a sign-in, which travels in the query string of the
auth routes, drop the token and keep any other entry of the fragment. A visitor
who signs in from a shared chat comes back to the chat by id and opens the link
again. A test for each flow proves that no address it sends holds the token. A
learner who is not the owner reads the chat, its conversation and its messages
only with that token, and every other read answers as if the chat did not exist,
whether the chat is private, shared or gone. Turning sharing off, or deleting
the chat, deletes the token, so every link stops at once, and turning sharing on
again draws a new one. No list of another learner's chats exists, so a profile
lists chats for its owner alone. A chat that was public before share tokens had
only its id for a link: that link stops working when share tokens go live, the
chat goes back to private, and its owner shares it again to get a link.

The chat route renders its header on the server and the conversation after
hydration, because a server never sees the fragment, and asking for the chat
before the token is read would show the access denied state to a reader whose
link is right. Convex data does not reach a server render, so before share
tokens the server rendered the header and an empty conversation too.

Two temporary contract steps remain from the change that introduced share
tokens. This ADR owns them, and they end together. Until they do,
`chats/unshare:closeLegacy` sends the public chats that have no token back to
private, and `getChats` answers an empty page for the browser tabs that were
opened before share tokens and still ask for the chats of a profile. The exit is
met when a dry pass of `closeLegacy` over every chat finds no legacy chat on dev
and on production, and the release has been on production for 12 hours. That is
how long the project's skew protection keeps a browser on the web deployment it
loaded (`skewProtectionMaxAge` 43,200 seconds, read from the Vercel project on
12 October 2026): after it, a navigation in an older tab loads the build that
no longer calls `getChats`. The cleanup is one change: delete `chats/unshare`
with its tests, and delete `getChats` with its test.

Nina's system prompt leads with stable instructions so provider prompt caching
reuses them across turns. The current page, which learners share, the learner
block, a question focus, and the conversation summary follow in that order. The
facts of one turn, such as the date, the page URL, and the tool policy, travel
in a block at the start of the newest learner message instead, so everything
before that message repeats from step to step and from turn to turn. The page
they name is the one the learner is on now, even when the chat began on another.
On a verified learning page, generation
reads the signed page once before the first model step and places it in that
context within the page token budget. The model spends no forced tool step on
it and asks Nakafa for other sections.

Math, Nakafa retrieval, and external research are Agent tools implemented as
Effect programs. Specialist agents use the same Convex AI gateway provider and
Agent usage handler. Tool results retain progressive evidence cards and final
model-facing evidence, which never exceeds the evidence token budget: a
truncated output says what it omitted and how to ask for it, and Nakafa reads
continue by heading section, or by numbered part inside a section too long for
one read, with the following sections listed first. Context compaction changes
provider input only; it does
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
within 16,000 tokens. The turns come from the chat's turn records, by turn
order, not from the last messages of the thread: a cancelled or failed turn
leaves no messages in it, and a question the learner asked again appears once,
in its newest asking, whichever of its askings the learner retried. A retry
stores the order of the turn that first asked its question, so every asking of
one question carries one key. A retry names the page the learner retries from,
like a new message. One from the page its turn was asked on, or from a browser
tab that sends no page, keeps that turn's own context, with its placement and
question focus. Older evidence shortens with a visible note before a turn is
dropped, and no budget fails a turn. Earlier turns keep their images, while
their PDF and text attachments, whose cost grows with size, leave provider
history as a note naming the file. An image counts 1,120 tokens whatever its
size, what Gemini 3 bills at its default media resolution, which Nina leaves
unset, so a few images fill the history budget. A stored message keeps neither
the size nor the page count of a file, so the rule reads the media type alone.
The learner's own message and its attachments are not evidence and do not count
against the evidence budget.
After a completed turn, the follow-up action
folds the complete turns beyond the four newest into the chat's conversation
summary with a fast model once four such turns accumulate, at most 16 turns per
refresh, so a longer backlog advances one bounded batch per turn and reads back
only from its last folded turn. The fold leaves out what the history would: a
cancelled or failed turn, and an answer that a later retry replaced. The
summary, at most 1,200
tokens, sits in the system prompt context and is deleted with its chat. Its
refreshes are chat upkeep, so their provider usage accumulates on the summary
rather than in a turn's usage ledger, which clients read. The learner profile
and learner memory follow [ADR 0022](./0022-memory.md). Old
reasoning is excluded from provider history; full conversation data stays in
Agent storage. External research admits at most
8 exact source URLs before provider work, with 3 concurrent fetches and 8,000
selected characters per source. Excess requests receive an explicit limit;
sources are never silently omitted.

Convex deployments own `FIRECRAWL_API_KEY`, `MATH_CAS_API_KEY`, and
`NEXT_PUBLIC_CAS_URL`. The CAS key must match the
production CAS service, and its URL is `https://cas.nakafa.com`. These are
backend action configuration, not Next.js environment inputs. Resolve CAS
configuration before asking the math specialist to generate tool calls, so a
missing service cannot consume generation tokens or masquerade as checked work.
No release check runs a real Agent math request yet, so the stored
deterministic artifact of a math request is verified only against controlled
models. The release gate under Verification asks about a Nakafa page, not for a
calculation.

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
idempotency, ownership, uploads, context, and retained conversation history.
Agent integration tests use the real component with controlled provider models.
Local production browser acceptance opens the composer on the home page, the
chat page, and the lesson sheet at two widths. It checks the geometry of the
controls and the preview and removal of an attachment. No browser test sends a
message, reconnects a stream, or scrolls a thread: the local backend runs no
model, because a local deployment cannot reach the gateway.

### Release gate

Every check above uses a controlled model. The release gate runs one real turn
through the Convex AI gateway and judges the turn that Nina stored. Run it before
a release of anything under `packages/backend/confect/nina` or
`packages/backend/confect/gateway`, on a deployment that already runs the
change. It is not part of CI.

```sh
pnpm --filter @repo/backend nina:gate
```

The command reads the deployment from the caller's own configuration:
`CONVEX_DEPLOYMENT` in the shell or in `packages/backend/.env.local`. It runs
only when that names a dev deployment, and it refuses to run when a deploy key
or a deployment token is set. The Convex CLI picks its deployment from all
three settings: a key or a token wins over the name, a project key ignores the
name, and a key with no type means production. So with a key set nothing could
say where the gate would run. The CLI also loads `.env` and `.env.local` into
the settings that are not set, so the command starts it with the deployment the
check read and with the key and the token blank, and a file cannot send a
command to a deployment that the check did not see.

The command signs in a synthetic learner with the rows the acceptance runtime
creates. A sign-in that fails part way removes the rows it wrote. The command
asks one question about a lesson with a link to that lesson's own page, and reads
the stored turn through `nina/conversation:get` once the turn has settled and,
for a short while longer, until its suggestions are saved and, for the first turn
of a chat, the call that names the chat has recorded its usage, because that call
starts after the suggestions are saved. It reads the steps of the chat agent from
the Agent journal of the thread, because the usage record sums the steps of an
agent and cannot show which step read the cache. A link to Nakafa's own site
starts Nina's first step with the Nakafa capability, so the answer always has a
second step. The deployment must hold the signed release of that lesson.

The command prints one table: the steps, input, cached, output and reasoning
tokens, the cost in US dollars, and the seconds the turn took, for each agent and
in total. A line under it shows the cached input tokens of each chat step. The
command prints no message text. Then it removes the chat and claims the deletion
of the learner, the same claim that Better Auth's before-delete hook makes. It
does not run the hook's own check that PostHog erasure is configured. The account
recovery sweep finishes the deletion in about twenty minutes. A removal that
fails is logged with the learner or chat it left behind, and it does not change
the verdict.

The gate passes only when:

- the turn is complete, which the settlement allows only once the Agent journal
  holds a final answer with text;
- every call of the usage record ran on the gateway's model with the gateway's
  provider id, as the usage rows store them;
- the chat agent took at least two steps and each step after the first read
  input tokens from the provider's cache, which the first step wrote;
- no chat step ended at its output cap, and no other agent wrote as many tokens
  as its steps would write at the cap of their purpose;
- the turn ended inside its deadline, counted from its admission: the wait for
  its run to start, the total budget of the chat call, and half a minute to
  settle.

It proves that a real provider run through the production adapter ends in an
answer, records its tokens, and reads its prompt cache at every step after the
first. A first step that already read the cache means that an earlier turn with
the same prompt prefix warmed it, which the provider allows for about five
minutes, so the later reads then do not prove that this turn wrote the cache. The
line under the table says so, and the gate is run again after five minutes. The
cost is printed and not judged, because a call that reports no cost has none. The
gate does not prove that every specialist step stayed under its cap. The usage
record sums the steps of those agents, so a row of one call is judged exactly, and
a row of several calls only by its sum: one step at its cap among shorter ones
passes. It does not prove the quality of an answer, because it reads no message
text. It does not cover the math, research, and Quran capabilities, memory
capture, the conversation summary, attachments, or a turn on production, where a
real turn is checked by hand.

## Learning engagement

Continue Learning and popularity use durable read models with bounded reads.
Daily viewer keys expire after their UTC day. Daily signals remain through the
seven-day window the homepage ranks by, and no total outlives it. Retention
follows ADR 0008.

## References

- https://confect.dev/v10/concepts/services
- https://confect.dev/v10/server/components
- https://confect.dev/v10/clients/react
- https://confect.dev/v10/server/scheduling
- https://docs.convex.dev/agents/context
- https://docs.convex.dev/agents/streaming
- https://docs.convex.dev/agents/messages#optimistic-updates-for-sending-messages
- https://docs.convex.dev/agents/usage-tracking
