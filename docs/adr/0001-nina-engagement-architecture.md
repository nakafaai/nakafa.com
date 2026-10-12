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
whether the chat is private, shared or gone. A reader is told where each turn
stands and which prompt it answers, and never what it cost, what Nina kept from
it or what she suggests next, because those belong to the owner's account: the
owner, who opens a chat by its id or through their own link, is told all of it.
Turning sharing off, or deleting the chat, deletes the token, so every link
stops at once, and turning sharing on again draws a new one. One thing outlives
a link: the address of a file attached to a message. The link guards the chat,
not the files in it. A reader sees an attachment through the address that file
storage gives it, which works for anyone who holds it until the file is deleted
(the [Convex documentation](https://docs.convex.dev/file-storage/serve-files)
says anyone with the URL can access the file, and that deleting the file revokes
it), so turning sharing off takes the chat from a reader and leaves them the
address of a file they already saw. Deleting the chat deletes its files within
two days: the Agent component keeps a file that nothing refers to for 24 hours,
and the storage sweep runs daily. The owner accepted this exception on 12
October 2026, and it is not engineered around. No list of another learner's
chats exists, so a profile lists chats for its owner alone. A chat that was
public before share tokens had only its id for a link: that link stops working
when share tokens go live, the chat goes back to private, and its owner shares
it again to get a link. `apps/www/e2e/chat/share.browser.ts` proves the whole
life of a link in the production build: a reader with no session and a learner
signed in as someone else read the chat, are offered no box to write to Nina,
no menu to rename, share or delete the chat and no button to send a message
again, and send no mutation or action to the server, the address without the
fragment opens what a chat that is not there opens, the pages that hold the
chat lose it without a reload when sharing stops, sharing again makes a
different link while the first stays dead, and no request of the reader's page
holds the token, the analytics it reported included. The local runtime has no
model, so each of its turns ends with the failure that offers no retry, and the
browser test reaches no answer with follow-up suggestions and no failure that
can be retried. A reader is sent no suggestions, and the Retry of a failed
answer reads the same access as the composer, `readChatAccess`, which a unit
test pins for a reader.

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

Provider input keeps whole turns that the conversation summary does not
cover, newest first, within 32,000 tokens, and the current turn's evidence
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

One call carries at most `NINA_CALL_LIMIT` tokens by design, the sum of the
budgets in `confect/nina/budget.ts` that a call holds at once. The budgets are
counted with OpenAI's tokenizer, and the model is Gemini, so the number is close
to what the provider bills and not the same. Measured on 12 October 2026 through
the gateway on five stored sections, the provider counted between 8.2% fewer
tokens (Arabic verses with their translation) and 13.6% more (a lesson full of
formulas) than the budget's count, and within 6% for German, English and
Indonesian prose. A message adds no tokens around its content, and a tool call
with its result costs what the budget counts for them. The model accepts
far more, 1,048,576 input tokens. Nina stays below because every call bills
every token it carries, a larger call takes longer to start, and the provider
keeps a cached prefix for only about five minutes. Three things lie outside the
number: the learner's own message and files, which admission checks, a question
focus, which has no budget, and the words of the newest earlier turn. That turn
is kept whatever it costs and only its tool results are shortened, never the
words of the learner or of Nina, so one very long message or answer in it takes
the history above its part.

The size of the history starts a fold of the conversation summary. After a
completed turn, the follow-up action counts the complete turns the summary does
not cover in model tokens, as the history would send them. A chat whose turns
fit in the 32,000 token history budget, and that holds at most 64 of them, is
never folded. The count is a second, much wider bound: a turn also costs
documents to read before the call, which no token counts, so very short turns
would otherwise let the history grow to thousands of messages. Past 64 turns one fold covers the oldest 16, and the
next waits for 16 new ones. When the turns cost more than the budget, one fold
summarizes the oldest of them with a fast
model, as many as it takes for the rest to cost at most 16,000 tokens, half the
budget, so the next fold waits for about half a budget of new turns and the
cached prefix holds in between. The newest complete turn is never folded, a
fold covers at most 16 turns, and a longer backlog advances one bounded batch
per completed turn. When the count reached the oldest of the turns, the fold
summarizes from the messages it read. Otherwise it reads back from its last
folded turn alone. The fold leaves out what the history would: a cancelled or
failed turn, and an answer that a later retry replaced.

Between two folds the history only grows at its end, with two exceptions, and
each changes the cached prefix. A retry takes the asking it replaces out of the
history, wherever that asking is. And a call whose turns outgrew the budget
before a fold covered them drops its oldest turns from that call's input until
the rest fits. That happens while a fold is still running, after one failed, and
while a backlog longer than one fold, such as a chat from before summaries, is
folded one batch per turn.

Turns are read newest first, 16 at a time, and the read stops after the page
that brings them past the history budget. A replaced asking never reaches the
model, so it does not count toward that budget. The read also stops once it
holds 64 turns, and once it has passed 32 askings it keeps nothing of, so a
learner who retries one
question again and again cannot make every turn read the whole chat. The turns
behind such a run are in neither the history nor the summary, and the next fold
takes them first. Counting costs a read: a completed turn reads the turns after
the summary, as the next generation will, which is about a history budget of
messages and at most 32 replaced askings. A stored total would avoid that read,
at the price of a field on every turn that must stay right through retries,
failures and folds, and Nina has none.

The summary, at most 2,000 tokens, stays in the language of the conversation,
adds no fact the turns did not state, sits in the system prompt context and is
deleted with its chat. Its
refreshes are chat upkeep, so their provider usage accumulates on the summary
rather than in a turn's usage ledger, which clients read. The learner profile
and learner memory follow [ADR 0022](./0022-memory.md). Old
reasoning is excluded from provider history; full conversation data stays in
Agent storage. External research admits at most
8 exact source URLs before provider work, with 3 concurrent fetches and 8,000
selected characters per source. Excess requests receive an explicit limit;
sources are never silently omitted.

The research model writes the search queries and reads the results, so code
only trims, deduplicates, and bounds the queries and never filters a result by
its words. The tool input tells the model the 500 characters that the search
provider accepts for a query, so no query is cut. No letter case, word shape,
or word length decides what a learner meant, because a rule built on one
treats a task in Japanese, Arabic, or Thai differently from the same task in
English.

A page longer than its budget keeps the paragraphs that hold the most of the
words of the tool call: the text of its request, its objective, and each item of
its lists, one per line with no heading. The words are not taken from the
Markdown task that the research model reads, so a heading that the task writes
never scores a paragraph, and a line of the request that starts with `#`, such
as a pasted heading or a hashtag, is looked for like any other. The platform's
`Intl.Segmenter` finds the words of every script, also of those written without
spaces. A word counts once for a paragraph, however often the paragraph repeats
it, and it weighs less the more paragraphs of the page hold it, so the words
that fill every paragraph, such as particles and prepositions, weigh little
without any list of words to skip. A word matches only as a whole word: an
inflected form of a word of the tool call, such as `cats` for `cat`, does not
match it, because no stemmer covers every language and a wrong stem is worse
than a miss.

A cut ends where `Intl.Segmenter` ends a sentence: after a full stop, a
question mark, an exclamation mark, a Japanese `。`, or a line break. A script
that marks no sentence end, such as Thai, which separates its sentences with a
space, is one sentence to the segmenter, so a cut in it falls back to the end
of a paragraph, a line, or a word.

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
command to a deployment that the check did not see. The check and the start of
the CLI live in `scripts/development/cli.ts`, and the model test of knowledge
search (ADR 0023) runs behind the same check.

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
