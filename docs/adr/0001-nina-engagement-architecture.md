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
The same holds for the account itself. The chat a reader is sent names neither
the account that owns it (`userId`) nor the turn that runs in it
(`activeTurnId`), and no message a reader is sent names an account. What a page
needs of a chat is its id, its thread to list the messages, its title and its
visibility, and it takes a chat that names no owner as not its own, so
`readChatAccess` gives a reader nothing to write. The owner is told every field
the chat had, so an older page decodes the owner's chat as it always did, and an
older page is never a reader of a link, because only a page that sends the token
reads by one.

The conversation is not a fact of the account, with one exception: what Nina
looked for in the owner's memory is. A search of memory tells a reader what Nina
looked for (the stored call holds the query, in the owner's words), whether
something matched (the stored result is a note, a line that nothing was found,
or the denial) and whether the owner paused memory. So the page of messages a
reader is sent holds no part of a memory call: neither the call, nor its result,
nor the step marker that Agent writes in front of a call. `nina/reader.ts` drops
them in the one projection that also drops the account from each message, and
reads the name of the capability from `capability/spec.ts`. The owner is sent
every part, by the chat id and through their own link, the "Recalled memories"
row included, whose stored result is a note and never the words of a memory (ADR
0022). A message left with no part is the empty answer that Agent saves as
pending when a turn begins (`saveInputMessages.ts` in the installed Agent), which
the page shows as Nina typing while the turn runs (`isAnswerWaiting`) and as an
empty answer once the turn has ended.

What a turn cost rides in the messages too. The Convex gateway reports the cost
of a call in the metadata of the provider (`convexGateway.cost`, written by
`@convex-dev/ai-sdk-provider`), Agent stores the report of a step on the
messages it writes from the step (`serializeStepMessages`), and `toUIMessages`
copies it onto the parts it builds from them: `providerMetadata` on a text or
reasoning part, and `callProviderMetadata` on a tool part. So the same
projection leaves out of every part the three keys under which the AI SDK
declares such a report on a part (`PROVIDER_METADATA` in `nina/reader.ts`), as
the turn summary leaves out the credits and the usage. The owner, who is told the
credits of a turn, is told the report too. `nina/messages.impl.test.ts` proves it
with a turn that ran: the owner's page holds the cost the model reported, and a
reader's page holds it nowhere, under any key.

What Nina wrote herself is not a fact of the account. A reader is sent her
reasoning and her answer as the owner reads them, even when they name a search:
a reasoning that says what she is about to look up, an answer that uses what she
found. The answer is what the owner shared, and no rule could cut the words of a
search out of it. The parts do not say which reasoning or text belongs to the
step of a call either, because Agent writes a step marker in front of a tool
call only, so a rule that cut the words around a call would cut by position and
still leave the answer. The rule is about the call, a fact the system records,
and not about what the model chooses to write. `nina/reader.test.ts` pins both:
the call goes, and the words around it stay.

A reader is sent no live stream either. After its first chunk, the chunks of a
tool call name only the call (`tool-input-delta`, `tool-output-available`,
`tool-output-error` and `tool-output-denied` hold a call id and no tool name), so
a read that holds no state cannot tell the chunks of a memory call from another
tool's. The stream requests of a reader's page are answered with no stream and
without reading the component: an empty list for the list of streams, and no
deltas for a request of deltas. Agent's hook (`useUIMessages`) asks for deltas
only for a stream it has listed, so the page never waits for a stream and never
asks for one, and the page of messages, which is a live query, tells a reader
each message when its step is saved. So a reader sees a running turn one step at
a time: Nina typing until a step that shows something is saved, and no sign of
progress while a later step is written, because the loader of an answer stops
once the answer shows a tool, reasoning or text part. The owner's own pages
stream as before.
`nina/reader.test.ts` pins the rules of both, and `nina/messages.impl.test.ts`
and `nina/memory/tool.test.ts` pin them on the real Agent component, with a live
stream and a memory call in the thread.

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
holds the token, the analytics it reported included. The turn summaries those
pages were told hold no cost, token count, memory count or suggestion of the
owner's, and the chat and the messages they were told name no account, while
the owner's own page was told the credits and tokens of its turn and the account
in its chat and in each message. They were told no live stream, no part of a
memory call and no part with what the provider reported for a call either
(`apps/www/e2e/support/told.ts`, whose own tests show that the checks fail for a
page that was told one). The local runtime has no model, so each of its turns
ends with the failure that offers no retry, and the browser test reaches no
answer with follow-up suggestions, no completed turn that shows the credits
control, no failure that can be retried, no part that a call wrote (a memory
call, the provider's report) and no live stream: for those it shows only what the
production build answers a reader's requests with, which holds none. The server
tests above are what fail when a reader is sent a stream, a memory call or the
provider's report, and one of them runs a real turn. A reader is sent no
suggestions, a reader's turn carries no credits for that control to show, and
the Retry of a failed answer reads the same access as the composer,
`readChatAccess`, which a unit test pins for a reader.

Nina's sheet reads a chat by its id and never holds a share token: a link opens
the chat page, and the chat the sheet shows comes from the learner's own list,
from a chat the learner starts, or from the browser's storage, where the sheet
remembers the chat it had open. A learner who signs in after another one in the
same browser can therefore open a sheet that remembers a chat they may not
read, shared or not. The server answers that read as it answers for a chat that
does not exist, the sheet forgets the chat and shows a new chat, and the
learner starts one or opens one of their own. The sheet gives each chat an error
boundary of its own: a boundary that resets on a change of keys does not reset
when the update that changes them hides the part of the sheet it sits in, and it
showed nothing for every chat after the one it caught.
`apps/www/e2e/chat/access.browser.ts` proves it in the production build: a
signed-in learner who holds no link opens the address of the chat and a sheet
that remembers it, and then opens a chat of their own in that sheet.

The chat route renders its header on the server and the conversation after
hydration, because a server never sees the fragment, and asking for the chat
before the token is read would show the access denied state to a reader whose
link is right. Convex data does not reach a server render, so before share
tokens the server rendered the header and an empty conversation too. The same
reader can meet the page the other way round: the address without its fragment,
and then the link in the same page, which a browser opens as a change of the
fragment and not as a load. The error boundary of the page shows access denied
for the first, so it resets when the token changes, and the page reads the chat
without a reload. The token is only compared there and goes nowhere else.

The share dialog reads the token of the link with a query, which can fail: with
a typed failure when the server cannot read the account, and with a defect when
it cannot open the sealed token. A failure shows in the dialog, as one sentence
and a button to load the link again, which asks the server anew, and it never
takes the chat page with it: the dialog has an error boundary of its own, so the
owner of a chat is not told that it is not their chat because a link did not
load. `apps/www/e2e/chat/link.browser.ts` proves the late link, and the dialog
that says so when the query fails with the typed failure and loads the link
again on Retry, in the production build.

The change that introduced share tokens kept two temporary contract steps,
`chats/unshare:closeLegacy` and an empty `getChats`, until a dry pass of
`closeLegacy` found no legacy chat on dev and on production and the release had
been on production for 12 hours, the project's skew protection window
(`skewProtectionMaxAge` 43,200 seconds). Both passes found none on 13 October
2026, and both steps are deleted.

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

Nakafa retrieval, external research, deterministic math, and the learner's
memory are Agent tools implemented as Effect programs. Each is one capability
definition in its own folder, listed once in `capability/registry.ts`: its name,
the Schema of its input, the description and tool policy the model reads, the
rule that offers it in a turn, and its run. One shared runner
(`capability/define.ts`) builds every tool from its definition, so the policy
check, the denial answer, the progress rows, the deadline, the failure
classification and the settled outcome exist once. Specialist agents use the
same Convex AI gateway provider and Agent usage handler. Tool results retain
progressive evidence cards and final model-facing evidence, which never exceeds
the evidence token budget: a truncated output says what it omitted and how to
ask for it, and Nakafa reads continue by heading section, or by numbered part
inside a section too long for one read, with the following sections listed
first. Context compaction changes provider input only; it does not discard the
stored transcript. Math uses deterministic computation, Nakafa uses
authenticated signed content, and research admits retrieved sources.

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
counted with an estimator fitted to the provider's own count (`countTextTokens`),
not with a tokenizer, so the number is close to what the provider bills and not
the same. Measured on 13 October 2026 through the gateway on 120 texts, the
estimate was 0.4% above the provider's count in total and 9.1% off for one text
on average, and its doc comment names the kinds with the largest errors. A
message adds no tokens around its content, and a tool call with its result costs
what the budget counts for them. The model accepts
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
rather than in a turn's usage ledger, which clients read: a web build decodes
only the agent names it was built with, so a refresh recorded under a name of
its own would stop every build opened before that deploy from reading its
conversation until it reloaded. A refresh whose answer is empty or cut at the
output cap stores no text and counts its tokens all the same. A chat's first
refresh has no summary to count them on, because a summary holds text, so a
first refresh that is rejected counts nowhere. The learner profile
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

A search that names sites is restricted by the search provider's own field. The
web search tool input has an optional `sites` list of at most five hostnames,
a bound of Nakafa's own because the provider states none, and every query of the
call is sent with it as `includeDomains`. A missing or empty list sends no
field. A site the model writes as an address is reduced to its hostname by the
platform `URL`, and that hostname must belong to the public web by the public
suffix list that `domain.ts` also reads for citations and for the links a
learner writes. A text with a comma, an underscore, a wildcard or a space, an IP
address, `localhost`, and a single word that is no listed suffix are none of
them a site. No code reads a `site:` operator out of a query, and no second
filter runs over the results.

A list of more than five sites, or one text that is no site, refuses the whole
call, as a call with no query is refused, and the tool description says so.
Research then goes on with the learner's own links, or ends with the error
`Research search wrote no usable query.` Nothing drops a site or widens the
search quietly, because a search that names its sites and runs without them
brings back the sources of other sites that this field exists to keep out. A
task that names more than five sites is an open search, and the model leaves
the field out.

The provider documents `includeDomains` as restricting results to the given
hostnames and says it adds `site:` operators to the query itself
(https://docs.firecrawl.dev/api-reference/endpoint/search and
https://docs.firecrawl.dev/features/search, read on 12 October 2026), but
neither page says whether that holds for the news source, so it was measured on
the production plan the same day: the news source answered
`site:snpmb.bppp.kemdikbud.go.id "2027"` with five results and all five were
from other sites, while the same words with `includeDomains` returned no result
from another site. The model guidance therefore says to use the field and not
to write the operator.

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
analytics remains subject to account consent. A stream that stops at the AI
SDK's own total, step or chunk deadline is stored as a response timeout: the SDK
reports those deadlines through the abort of the stream, naming a timeout as its
reason, and never through the error callback.

Every way a turn can stay open ends in a settlement that the learner sees and
leaves, through the one guarded settlement, so the credits come back once and
the chat is free:

- Admission schedules one check for the moment the run must have started. It
  settles a turn whose run never started as a response timeout, and leaves a
  turn that was claimed or settled alone.
- The sweep, every five minutes, settles a turn that stays open past its
  deadline. No live run is open that long, so the run was lost to a crash or a
  deploy, and the turn is stored as interrupted, never as a timeout. Such a run
  has no live action to report it, so the settlement does, once, when a turn
  ends without an answer after its deadline (`closeTurn`), whichever status it
  stores, as when the learner deletes the chat in the meantime: the log names
  the turn, the reason it was stored with and how long it was open, and error
  tracking gets the reason and the place, with no turn, no account and no word
  of the conversation. A turn the learner stopped or that holds an answer is not
  a loss. A run that ends its own turn reports its own failure, however late it
  fails, so the settlement leaves that one to it.
- The sweep also schedules the end of that settlement for three of its own runs
  later. A settlement that failed in every try, as when the Agent journal cannot
  be read or cut off, ends then without the journal it could not use: the turn
  fails, or is cancelled when the learner had stopped it, an answer the journal
  does hold still completes it, and the chat is free. Deleting a chat does not
  wait for it: when the journal fails the settlement of the chat's open turn,
  the delete ends the turn the same way, in the transaction of the delete, and
  goes on, so a journal that cannot settle the turn never keeps a learner from
  deleting their chat. A hold that cannot be paid back is the one thing that
  ending never drops. When the credit state cannot be read, the ending fails as
  a whole and changes nothing, and the next sweep tries again. A delete of that
  chat fails the same way, because the learner's credits are not dropped to free
  it. So does a delete whose journal cannot be deleted: it commits nothing, so a
  deleted chat never leaves its words behind, and the learner tries again.
- The failed turn stores `unknown`, which the learner reads as a response Nina
  could not finish, with a way to try again and to ask for help. A reason of its
  own would be a new value of the stored failure reason. Every web build reads
  that reason with the values it was built with, `ninaResponseFeedback` words
  each of them, and Skew Protection keeps a browser on its deployment for 12
  hours ([ADR 0008](./0008-compute.md)). So the web learns and words the value
  first, and the ending stores it once the older builds are gone. The log of the
  ending names the turn until then.
- A turn the learner stopped settles at their next prompt, in any chat. When its
  journal cannot be read, that settlement is skipped and logged with the turn,
  and the others still settle, so the failure of one thread never refuses a
  prompt in another chat. The stopped turn's own chat stays busy until a later
  try settles it or the sweep ends it.
- A stop reaches the provider call even when one check of the halt flag fails,
  and a failed check never replaces the reason a failed run stores. The stop
  reaches the repair of a tool call too.

A capability's result is stored in the Agent message row, which nests it below
the row, `message`, `content`, a part, `output` and `value`. Convex refuses a
document of more than 16 levels and logs a warning above 12, which is 0.8 of the
limit by its default ratio. Production logged that warning at 13 levels for a
math card with one step on 12 October 2026. So no stored result may pass 12
levels. A test builds the deepest value each capability's schema admits, saves
it in a message row and in a stream row, and counts it the way Convex does
(`packages/backend/test/nina/depth.ts` names the source it read, and
`capability/spec.test.ts` holds each capability to the bound). The message rows
measure 14 levels for math, 12 for Nakafa retrieval, 11 for research and 7 for
memory, and the stream rows 12, 10, 9 and 5.

Math is the one capability above the bound: its card nests `data`, `result`,
`steps`, a step and its `items` below the artifact. Flattening it changes the
stored shape that the page decodes with `CapabilityOutputSchema`, so it follows
the rollout rule of `packages/backend/AGENTS.md`: the schema first accepts both
shapes and ships to the web, and once no older build is served the writer stores
the flat one. Rows already stored keep their shape, because each was written
within the limit and none is written again. The schema keeps reading both
without an end date, and no migration rewrites Agent messages for a log line.
Until the flatten, the test holds math at the depth its card has: a card that
grows fails, and so does one that fits the bound, until the exception is
deleted.

## Adding a capability

A capability is one definition in its own folder and one entry in the registry.
The tools Nina is offered, the policy of each call and the tool section of her
prompt follow from them, and all three follow `offered`: a turn whose page does
not allow a capability, or whose learner paused it, is offered neither its tool
nor its entry and rules in the prompt, so that turn's prompt prefix differs from
the others, as its tool list does. Every page allows every capability today, so
only a pause changes it. A few other places still name a capability or its
Agent, and they are the steps below, in order, with what the compiler enforces
at each and what it leaves to the author.

1. Write the run, an Effect program in the capability's own folder. It takes its
   input and the facts of the turn, publishes its cards through `publish`, and
   ends with `{ text, outcome? }`. A model call inside it cuts its limits to the
   time left with `limitDeadline`. Left to the author: what the run does.
2. If the run calls a model, add its Agent to the usage ledger: one line in
   `AGENT_PURPOSES` of `contract/usage.ts`, with the purpose its calls run
   under. The list is not read from the registry, because the stored turn
   schema imports it and the browser loads that schema through the generated
   refs, so the registry would bring every runner into the page. Enforced: the
   ledger accepts no other name, and the output caps of the release gate follow
   the table and name no agent. A runner writes its Agent's name with
   `satisfies UsageAgent`, so it does not compile until the line exists. Left
   to the author: every web build decodes the ledger with the names it was built
   with, so the web build that knows a new name ships first and the run records
   under it once the older builds are gone, by the rollout rule of
   `packages/backend/AGENTS.md`.
3. Define it in `<folder>/capability.ts` with `defineCapability`: the
   description the model reads, the Schema of its input, its guideline for the
   tool policy (`entry`, `field` when its input has a field of its own,
   `section`), the `continuation` that tells the model how to ask for what a
   truncation omitted, `offered`, and `run`. Add `note` when its answer must
   stay out of the conversation. Enforced: `offered` and `run` have no default,
   so nothing is allowed by omission; the Schema types the input of
   `run`; the typed errors of `run` end as `CapabilityDenied` or `failed`, so
   none stays unhandled. Left to the author: a defect of `run` is not caught,
   and its message reaches Nina, the stored thread and the transcript as the
   text of a tool error. So a capability that handles the learner's private
   words ends every failure of its run, a defect too, with a fixed line and no
   message, and logs only the phase, as the memory capability does: its search
   ends as `MemoryReadError`, and a defect anywhere else in its run ends the
   same way.
4. Add its name to `LearningCapabilityNameSchema` in `capability/spec.ts`, and
   pick it in `TextOnlyCapabilitySchema` beside it when it publishes no card:
   its answer is the text, so a run that ends without a card is not read as
   empty, in the result it stores or on the page that shows it
   (`client/nina/outcome.ts`), and keeps the outcome it states, or none. Add
   its definition to the end of the record in `capability/registry.ts`. The
   order is the order of the tool list and of the tool policy, so it is part of
   the prompt prefix that the provider caches. Enforced: the record is
   `satisfies Record<LearningCapabilityName, Capability>`, so a name without a
   definition and a definition without a name do not compile. The tools Nina is
   offered, the policy of each call, the tool section of the prompt, and the
   tool names that history and the web recognize follow from these two.
5. In the web app, give the name an icon in the activity row and the keys
   `Ai.activity.<name>` and `Ai.tool-failures.<name>` in the en, id and de
   dictionaries. Enforced: the icon record is indexed by the name, the keys are
   typed by the English dictionary, and a test lists every name in all three.
6. If it publishes a new kind of card, add the card to the card schemas
   (`client/nina/capability.ts`, `contract/data.ts`) and its renderer to
   `evidence/list.tsx`. Enforced: that renderer matches the card type
   exhaustively.

Left to the author, because the compiler cannot judge them: the routing prose
that combines capabilities in `policy/tool.ts`, `step.ts` when the capability
should open a turn that names a source (the first step forces only a capability
the turn offers, because the SDK lists no other tool in it), and the tests. No
stored flag is added for a capability: `offered` reads the turn's context, and
the allow flags of a turn page stay as they are.

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
