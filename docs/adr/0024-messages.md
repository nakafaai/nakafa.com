# ADR 0024: Nina Messages Are Sealed By Replacing The Rows Of A Settled Turn

## Status

Accepted after the sealing spike of 12 October 2026. It decides the design and
the order of work. The title, the summary, the memory, the learner's message at
send, the file name of a new upload, and the rows and deltas of a settled turn
are sealed and live. The other stages in Decision are planned for program wave
A, the first delivery wave of the School program, and are not live yet.

## Context

A chat title, a conversation summary and a memory are stored sealed for the
learner who owns them (ADR 0001, ADR 0022). Message text is not. Messages are
the largest private text Nina stores: every question a learner typed and every
answer, with Nina's reasoning, the inputs of her tool calls and what the tools
returned. A table export, a backup or a look at the dashboard shows all of it,
and a summary sealed beside it protects little.

The Agent component writes the model's output itself, at the end of each step,
and has no hook that changes what it stores. The Nina System Blueprint of 10
October 2026 therefore left messages open until a spike had listed every reader
and measured the cost. The spike read the installed `@convex-dev/agent` 0.7.7 and
every Nakafa caller. It ran one real turn against the component with a model
double and searched every table for strings planted in it, proved the
replacement of rows against the real component, and measured the vault in the
repository's Convex test runtime. Those three probes were temporary tests and
are not in the repository.

## What The Agent Component Stores For One Turn

| Table | Rows for one turn | Holds text | Written by |
| --- | --- | --- | --- |
| `threads` | one per chat | No. Nakafa sets no title or summary (`turns.impl.ts:126`). | `createThread` |
| `messages` | the learner's message; a pending assistant row when generation starts (`saveInputMessages.ts:88-93`), which the first step replaces; then one assistant row per step and one tool row per step that called tools | Yes, in the fields below | The learner's message by Nakafa (`turns.impl.ts:147`). Every later row by the Agent client at the end of each step (`start.ts:384`, `messages.ts:224-433`). |
| `streamingMessages` | one per step stream | No | `DeltaStreamer` |
| `streamDeltas` | many per stream | Yes. `parts` hold the text, reasoning and source deltas. | `DeltaStreamer` (`streams.ts:77-119`) |
| `files` | one per upload | `filename` | `storeFile` |
| `memories`, `embeddings_*`, `apiKeys` | none | none | Nothing writes them here. Nakafa sets no embedding model. |

The text-bearing fields of a `messages` row:

| Field | What it holds |
| --- | --- |
| `message.content` | text, reasoning, the inputs of tool calls, tool results, file names and URLs |
| `text` | the text again, extracted from `message` (`messages.ts:355`) and indexed by `text_search` (`schema.ts:79-82`) |
| `reasoning`, `reasoningDetails` | the reasoning again, twice (`mapping.ts:309-321`) |
| `sources` | the titles and URLs of web sources |
| `error` | the reason a row failed |

`providerMetadata`, `usage`, `warnings`, `finishReason`, `model` and `provider`
carry no learner text. A real turn confirmed it. The probe streamed a
reasoning part, an answer and a source from a model double to a learner message
and searched every component table for four planted strings. It found 13
places and no more. The learner row held the message twice (`message.content`
and `text`). The assistant row held the answer twice, the reasoning three times
and the source twice. `streamDeltas` held the reasoning, the answer and the
source in one part each, and `threads` and `streamingMessages` held nothing.
The deltas stay for five minutes after a stream finishes (`streams.ts:69`,
`:377-386`) unless a delete removes them sooner (`deleteStreamSync` and
`deleteStreamAsync`, `streams.ts:585-616`).

## Who Reads Message Text

| Reader | Where | What it reads |
| --- | --- | --- |
| The next step of a turn | `generation.ts:90-96` | Nothing stored. `prepareStep` receives the messages the AI SDK holds in memory. |
| The next turn | `input.ts:32-58`, `:79`, `:116-127` | `listMessagesByThreadId`, newest first, 50 rows a page, `success` only, then `docsToModelMessages`. |
| The summary job | `summary.ts:90-127` | `listMessagesByThreadId` without tool rows, and `message.text` (`:114-118`). |
| Memory capture | `memory/capture.ts:154-167` | `getMessagesByIds` for the learner's message, and its `text`. |
| Retry | `prompt.ts:89-111` | `getMessagesByIds`, then `toModelMessage` and `fileIds`. |
| Replay of a turn start | `turns.impl.ts:72-97` | `getMessagesByIds`, then `toUIMessages` for the text and the files. |
| Suggestions | `presentation.ts:42-66` | The Agent's own fetch: `recentMessages: 50` without tool rows (`search.ts:154-190`). |
| Title | `presentation.ts:106-113` | The same fetch of 50 rows, and it uses one: `inputPrompt`. |
| Settlement | `settlement.ts:28-53` | The newest row, to see whether it holds a non-empty answer. It runs only for an active turn (`:95`). |
| The page of messages | `messages/page.ts` (`nina/messages:page`) | `listUIMessages`, which lists rows and runs `toUIMessages`. The page tells no turn facts: `conversation.turns` tells them. `messages.impl.ts` keeps the old `list` for clients opened before `page`, until its contract step. |
| Streaming | `streams.ts` | `listStreams` and `syncStreams`, which carry the deltas to the owner's browser. A reader of a shared chat is told no stream (ADR 0001). |
| Attachments | `nina/attachments.ts:22-31` | `getFile`, whose file or image part carries the component's `files.filename`, for the model's file part and the admission receipt. |
| Deletion | `triggers/chats/chats.ts:45` | `deleteAllForThreadIdAsync`, which deletes row by row (`threads.ts:184-247`, `messages.ts:59-71`) without reading content. |
| Recovery inside the component | `messages.ts:484-551`, `streams.ts:662-741` | `finalizeMessage` rebuilds a row from the deltas when a pending row has no content, and writes it from inside the component. |

Nobody searches message text. The chat search opens sealed titles and filters
them (`chats/list.ts`). The component's `text_search` index and `searchMessages`
are never called: the Agent runs a search only when `searchOptions` is set
(`search.ts:191-194`), Nina's agents set none, and no embedding model is set,
so the vector tables stay empty. The index is still maintained on every write.
No export of a chat exists in the repository. Analytics events and logs carry
no message text.

## What The Component Allows

Probes against the real component settled the mechanics: a thread with a
learner row, a tool-call row, a tool-result row and an answer row, and a second
thread with a failed prompt.

- `updateMessage` patches only `message`, `fileIds`, `status`, `error`,
  `model`, `provider`, `providerOptions` and `finishReason`
  (`messages.ts:553-570`). It recomputes `text` from the new `message`. After
  sealing the answer row with it, `reasoning`, `reasoningDetails` and `sources`
  were still readable in the same row. A row is scrubbed only by deleting it
  and adding it again.
- Deleting the assistant and tool rows with `deleteByIds` and adding sealed
  rows with `addMessages` gave rows with the same `order`, `stepOrder` 1, 2, 3
  without a gap, the same roles, the same `tool` flags and `status`, and no
  fields left to hold the planted strings. Opening the sealed payloads and
  running `docsToModelMessages` gave back the model messages.
- `addMessages` with the `promptMessageId` of a failed prompt marks every added
  row failed (`messages.ts:311-314`): rows that were `success` came back
  `failed`. With an explicit `order` the statuses stayed. A cancelled or failed
  turn therefore needs the explicit `order`.

## Measurements

The vault's `sealText` and `openText` (`vault/text.ts`) with learner keys
already derived, on text of the stated size, in the repository's Convex test
runtime (`edge-runtime` with convex-test) on a Mac with 11 cores. Other
sessions kept the machine at a load average of 45 to 61, so the medians are
inflated. The best column is the lowest single run of three repeats of 200 runs
(30 for 128 KB and 512 KB) and is the better guide to an idle core. The
blueprint's cloud measurement agrees with it: 500 seal and open pairs of 1 kB in
about 15 ms inside a Convex query is 0.03 ms a pair. A sealed value is 29 bytes
longer than its text.

| Payload | Seal, best | Seal, median of the three runs | Open, best | Open, median of the three runs |
| --- | --- | --- | --- | --- |
| 512 B | 0.07 ms | 0.32 to 0.76 ms | 0.04 ms | 0.21 to 0.40 ms |
| 2 KB | 0.06 ms | 0.20 to 0.56 ms | 0.03 ms | 0.13 to 0.36 ms |
| 8 KB | 0.06 ms | 0.31 to 0.39 ms | 0.04 ms | 0.18 to 0.29 ms |
| 32 KB | 0.08 ms | 0.32 to 0.70 ms | 0.04 ms | 0.21 to 0.39 ms |
| 128 KB | 0.24 ms | 0.48 to 0.86 ms | 0.13 ms | 0.36 to 0.49 ms |
| 512 KB | 0.85 ms | 1.56 to 2.61 ms | 0.30 ms | 0.82 to 1.97 ms |

| Work | Best | Median of the repeats |
| --- | --- | --- |
| Read a learner's keys (`readLearnerKeys`): one document, the root keys, the unwrap and the derivation | 0.59 ms | 2.8 to 4.7 ms |
| Of that, reading and deriving the root keys (`readRing`), with two root keys as in the test environment (two repeats) | 0.39 ms | 1.6 to 2.3 ms |
| Open a page of 50 messages, 394 KB in all: the keys and 50 opens | 4.0 ms | 27 to 69 ms |
| Seal an average turn of 9 messages, 47 KB: the keys and 9 seals | 1.4 ms | 4.9 to 7.4 ms |
| Seal a heavy turn of 40 messages, 498 KB: the keys and 40 seals | 4.7 ms | 21 to 29 ms |

The sizes of the average and the heavy turn are assumptions that stay inside
the code's bounds, not production data: a step limit of 20 (`generation.ts:105`)
makes 40 rows the most a turn writes, and a tool result is shortened to 6,000
tokens before the model reads it (`budget.ts:10-11`). Before the change, a
count of the real rows and bytes replaces the assumed sizes.
The measurements cover the cost of the cipher only. The cost of reading and
writing documents is counted in documents, because the test database says
nothing about it.

### The Seal And The Sweep Bound (order of work step 3)

The seal counts the bytes it reads and writes (`sealed/bytes.ts`, and the total
that `sealTurn` returns). Each document it reads counts once at its stored size:
the turn, its chat and its learner, its prompt, the page of rows it reads, and the
streams it lists. Each row it deletes counts twice, because the component reads it
to delete it and writes it away. Each row it adds counts once, and so does the turn
it replaces. Text counts by its UTF-8 length, binary by its byte length, a key by
its UTF-8 length, and a number or a boolean at a fixed 8 bytes. Not counted: the
learner's key row, the stream deltas, which the seal deletes in later pages
(`deleteStreamAsync`), and the component's index entries.

Measured with that counter in the repository's Convex test runtime, on two
fixtures that write the same kind of tool output:

| Turn | Counted bytes of one seal |
| --- | --- |
| Short: a question, one tool step with a 200-character output, and an answer (4 rows, no stream) | 6,134 |
| Long: a question, 20 tool steps with 24,000-character outputs, and an answer (41 rows, no stream) | 1,976,386 |

A real turn adds one stream document a step, a few hundred bytes. The 24,000-character
outputs of the long shape are an assumption of the measurement, not a measured
maximum of what a tool stores. An earlier spike probe, which wrapped the database
calls of one seal, counted 9,388 bytes for the short shape and 2,016,855 for the
long one. The counter in the code replaces it.

The budget. A sweep runs every five minutes (`SWEEP_INTERVAL`, `deadline.ts`), so
288 times a day. One gigabyte a day divided by 288 is 3,472,222 bytes, the budget
of a run (`SEAL_BYTES_PER_SWEEP`, derived in `sweep.ts`). The sweep schedules one
drain of the settled turns that still hold plain rows, oldest first, and the
drain seals each in its own transaction (`sealed/drain.ts`). A run starts a seal
only while the bytes it has counted, plus a reserve of 2,000,000 bytes, still fit
the budget. The reserve is the long shape's 1,976,386 bytes, rounded up. The first
seal of a run always starts, so a turn never waits behind the budget. A run then
ends within the budget, as long as no seal costs more than the reserve.

Projected from the measurements, for a backlog of one shape:

- Short turns: the seals start while the counted bytes are at most 1,472,222, the
  budget less the reserve, so a run seals 241 of them (240 at 6,134 bytes each,
  plus the first). That is 69,408 a day, and 10,000 old short turns clear in 42
  runs, about three and a half hours.
- Long turns: the first seal of a run starts, and a second would start at
  1,976,386 bytes, where the reserve no longer fits. So a run seals one long turn.
  That is 288 a day, and 10,000 old long turns take 35 days.

Failures and holds bound the cost of one broken turn. A failed seal rolls back whole,
so what it read is unknown, and it counts one `SEAL_RESERVE_BYTES` against the run's
budget, the same reserve a later seal must fit. The drain counts the failure on the
turn (`sealAttempts` and `sealFailedAt`, bounded fields) and logs an error with the
turn and the cause, the name of the error, never its message. After `SEAL_TRIES` (3)
failures the turn is held (`sealHold` `failedAttempts`), and the drain never takes it
again. A failed seal costs a whole reserve, so under the production budget it ends
its run, and the turns behind it wait: a turn that always fails delays the turns
behind it by at most `SEAL_TRIES` runs, about 15 minutes, and the next run seals
them. The one fault that stops a run at once is an unreadable key ring. The seal then
fails with `SealUnavailable`, which the vault's reason `configuration` raises. That
reason covers `VAULT_ROOT_KEYS` missing or malformed (`vault/ring.ts`), a root key
the platform cannot derive (`vault/ring.ts`), and a stored key that names a root key
the ring does not hold (`vault/keys.ts`). That fault blames no turn, so the drain
logs one error with the cause and counts no failure on any turn. A turn that the seal
skips on purpose is held at once, with `chatDeleted`, `accountDeleted` or
`promptMissing`. A held turn keeps its plain rows, which stay readable. A turn whose
run still holds a pending row younger than `RUN_LIFETIME_MS`, 30 minutes, is not
sealed yet: the seal writes nothing and sets neither `sealedAt` nor a hold, the drain
counts no failure, and a later run takes the turn again. A pending row older than that
belongs to a run that has ended, so the seal writes it as `failed`.

## Designs

**1. Seal the settled turn by replacing its rows.** The learner's message is
written sealed by Nakafa. When a turn settles, a separate mutation deletes the
turn's assistant and tool rows and adds them back sealed, with an explicit
`order`, and deletes the turn's stream deltas. Every reader opens.

**2. Keep the messages in a Nakafa table and give the component only what a
step needs.** The learner's message and the output of every step live in a
sealed table of ours. The component keeps no text.

**3. Seal at write behind the component.** `agent.streamText` takes the
`ctx` it calls the component with. A wrapped `ctx` could send the step save,
`ctx.runMutation(component.messages.addMessages, ...)` (`start.ts:384`),
through a Nakafa mutation that seals the message before it forwards the call.

**4. Change nothing.** Messages rest on Convex's encryption at rest and the
access checks.

**5. A codec in the component.** Ask Convex for a transform hook, so that the
component seals on write and opens on read.

| | Plain text at rest | Component fit | Verdict |
| --- | --- | --- | --- |
| 1. Replace rows | The rows of a running turn, and of a failed turn until the sweep seals it. A turn may run for `TURN_DEADLINE`, 8 minutes (`sweep.ts:23-26`), and the sweep runs every 5 minutes (`crons.ts:38-45`, `nina/deadline.ts:24`). The deltas until settlement. | Uses what the docs describe, saving and deleting messages, which are the component's `addMessages` and `deleteByIds`. ADR 0001 and the official hooks stay as they are. | Chosen |
| 2. Own table | None except the deltas. | Replaces what the Agent gives: see below. | Rejected |
| 3. Seal at write | The deltas, and rows that `finalizeMessage` rebuilds from deltas inside the component. | Depends on the Agent client's internal calls. | Not now |
| 4. Change nothing | All of it. | None. | Rejected |
| 5. A codec | None. | The right place, but it does not exist. | Asked for in parallel |

**Why not the table of our own.** The hardest part is the stream, not the
store. `Agent.streamText` takes the `order` and `stepOrder` of a stream from the
pending row it saves or, with saving off, from the stored prompt its context
fetch finds (`start.ts:194-231`, `:321-324`). With saving off and no history
fetch (Nina fetches none, `generation.ts:70`), both are 0. The browser drops a stream that has the `order` and `stepOrder` of a
stored, finalized row (`dedupeMessages`, `useUIMessages.ts:177-203`), so a stream at
`stepOrder` 0 would vanish beside the learner's row at the same position. The
documented way around it is to stream with `DeltaStreamer` and choose `order`
ourselves (docs.convex.dev/agents/streaming). That leaves `Agent.streamText` and
with it the tools' context, the usage handler, the pending row, the atomic
finish of the stream with the last save (`streamText.ts:224-262`) and the
failed-prompt rule that settlement relies on (`messages.ts:311-314`,
`settlement.ts:55-83`). It also gives Nina a second transcript, which ADR 0001
rules out, and a page query that must build the Agent's `UIMessage` shape from
our rows by hand. It buys one thing: a store with only one form. Design 1 gets
the same rest state for a window of a turn.

**Why not seal at write.** The wrapped `ctx` depends on how the Agent client
calls the component, which the package does not promise, and it cannot reach
`finalizeMessage`, which rebuilds a row from the deltas and writes it plain from
inside the component (`messages.ts:484-551`, `:523`). The settle-time routine of
design 1 is needed to catch those rows, so design 3 would add a second mechanism
to remove a window of at most a turn. It stays an option if that window is
judged too long.

**Why not change nothing, and why a codec later.** Leaving messages plain keeps
the largest private text in a form that an export, a backup or the dashboard
shows, which the blueprint rules out. A codec in the component is the cleanest
answer, since the component would seal on write and open on read, but nothing in
the installed package or its documentation offers one. Design 1 does not stand
in its way: if the hook ships, the module keeps its opening and the settle-time
routine goes.

The four questions of this spike, for the two designs that could win:

| | 1. Replace rows | 2. Own table |
| --- | --- | --- |
| What a reader costs | One key row for the function and one open for each row it reads. The reads are the ones it makes today. | The same key row and opens. The page and the history read our table, and the running turn's rows come from the component. |
| What breaks in the component | Text search finds nothing. The Agent's own fetch reads skeletons. Ids change once. | The stream order and its dedupe, the pending row, the atomic finish, the failed-prompt rule, and the `UIMessage` shape, which we would build by hand. |
| What a shared chat means | The owner's keys open the page for each viewer the token admits. | The same. |
| How old messages migrate | The learner's row is sealed in place and the other rows are replaced in place. No new table. | Every row is copied into the new table, an anchor row per turn stays in the component, and the rest is deleted. |

## Decision

Nina messages are sealed in two moves, and the Agent component keeps owning the
threads, the rows, the order and the streams. Only the content of its rows
changes.

1. **The learner's message is written sealed.** `turns.start` already writes it
   (`turns.impl.ts:147`). No plain copy of the learner's message ever rests in
   the component. Its row can also be sealed in place later, because it has no
   `reasoning`, `sources` or other field to scrub.
2. **The Agent's rows are replaced after the turn settles.** Settlement stays as
   it is, except that it also schedules a `seal` mutation at zero delay, as it
   already schedules `present` (`settlement.ts:88-95`), so a failure of the
   seal never blocks a refund or leaves a chat busy. The mutation reads the
   turn's rows, deletes the assistant and tool rows and adds them sealed with an
   explicit `order`, then deletes the turn's stream deltas with
   `deleteStreamAsync`, which pages itself, because a stream of large tool
   output can hold more deltas than one transaction deletes. A cancelled and a
   failed turn go the same way, and a chat that has been deleted since is left
   alone. A settled turn records `sealedAt` when its rows are sealed, and the
   sweep that already settles stuck turns also seals any settled turn without
   it, so a missed seal is found and not forgotten. The sweep finds those turns
   through the index `by_phase_and_sealedAt_and_sealHold`, which order-of-work step 3
   adds, and seals them oldest first within the byte budget of a run (The Seal And
   The Sweep Bound). The seal skips a turn that already carries `sealedAt`, so a
   retry is safe, and a seal that fails leaves the turn plain and readable until the
   next run that takes it.
3. **One module owns the form, and every reader opens through it.** A reader
   gets rows from the module and never from the component.
4. **Chat attachments.** The file name of a chat attachment, the `files.filename`
   field that the component keeps, is sealed with the learner's key in program
   wave A. The component has no way to change a file's name, and the storage
   sweep deletes a file's bytes with its row, so an attachment written before
   wave A is retired data: the change removes its row and its bytes, as the sweep
   removes any unused file, and no copy is written under the sealed name. The module that owns the sealed form opens a file's name too: the
   attachments reader takes the file through it and gets the part with its name
   opened, so neither the model's file part, the admission receipt, nor the page
   sees the sealed form. A file part inside a message row is sealed and opened
   with its row. Wave one kept the name plain: `getFile` moved into the module
   (`confect/nina/sealed/file.ts`), which returned the stored name. In wave two
   (S2b) the module seals a name and opens it. `sealFileName` seals the name
   with the learner's key, under the field `{ table: "files", field: "filename" }`
   with no row, because the component gives a file its id only after it stores
   the name. The stored form is the prefix `nakafa.sealed.v1:` followed by the
   sealed bytes in URL-safe Base64. A seal is deterministic for one learner and
   one name, so the Agent still reuses a file that the same learner stores again,
   and two learners never share a name, so the Agent never reuses one learner's
   file for another. The upload that stores a file records that it sealed the
   name, in `nameSealed`, when it reserves the upload. `readFile` opens a name only
   for such an upload, and it reads any other name as it is, because a name stored
   before sealing can begin with the prefix. A send reads the learner's keys once,
   and only when a name is sealed. A retry reads no name, because its size check
   reads the storage entry alone. The stored file is removed within two days of its chat's
   deletion, as
   the live policy already says (ADR 0001). The cleanup runs once a day, and it
   removes a file once no chat refers to it and 24 hours have passed since its
   last reference changed. This plan does not seal the bytes of an upload. A new
   upload seals its name at upload, before the component stores the file (order
   of work, step 2).
5. **The request fingerprint is keyed.** `turns.start` recognizes a repeated
   request by the fingerprint that the turn stores with its request id. The
   fingerprint is the blind hash of the learner's key over the request, `[chatId,
   input]` as JSON: the HMAC-SHA-256 of `vault/cipher.ts` under the learner's blind
   key, bound to the field `{ table: "ninaTurns", field: "fingerprint" }`, cut to
   16 bytes and written in URL-safe Base64 (`nina/fingerprint.ts`, `vault/text.ts`).
   An unkeyed hash of the request would confirm a guessed short message against the
   database, which the seal has just hidden. A repeated request still matches itself,
   because the learner's key stays the same. Every fingerprint that `turns.start`
   stores now is keyed. A fingerprint stored before this change is an unkeyed
   SHA-256 in lower-case hexadecimal, 64 characters, which a reader of the database
   could use to confirm a guessed request. A one-off internal mutation removed that
   value from every settled turn on production on 17 October 2026, and wrote no active
   turn: the run after the deploy cleared 65 of 1,126 turns and found no active turn
   holding it, and the run after the longest turn had settled (`TURN_DEADLINE`) found
   none left. The one-off was deleted afterwards. A retry of an id whose turn has no
   fingerprint, or still holds the unkeyed one, is refused as a conflict, which the
   decision accepts, because a replay is bounded to the short window of its turn.

The stages, and the key that seals each one (owner decisions K2, K3, and K10):

| Stage | Sealed with | Status |
| --- | --- | --- |
| Title, summary, and memory | The learner's key | Live |
| The learner's message, at send | The learner's key | Live (order of work, step 2) |
| The rows of a running turn | Not sealed while the turn runs | Plain, by design |
| The private reply and tool rows, once the turn settles, in one transaction | The learner's key | Live (order of work, step 3) |
| The reply and tool rows of a failed or cancelled turn, at settlement, the sweep as backstop | The learner's key | Live (step 3). Its prompt is sealed at admission (step 2). |
| Stream deltas | Not sealed; deleted at settlement by the seal | Live (order of work, step 3) |
| Old messages, removed by the sealing change | The learner's key | Planned (Old Messages) |
| Chat attachment file names, new uploads | The learner's key | Live (order of work, step 2) |
| Chat attachment file names, uploads before step 2 | The learner's key | Planned, removed by the sealing change (Old Messages) |
| School Nina thread, from the class's creation; no personal memory (K3) | The school's key | Planned |

Cost, in documents: a turn of n rows costs n - 1 deletes and n - 1 inserts at
settlement, 16 writes for the 9-row average turn above and at most 78 for the
40-row limit, plus the stream rows, which the component deletes five minutes
later anyway. The rows are read once. A sealed row is about as long as the plain
row it replaces.

### The Sealed Row

A sealed row keeps in the clear what the component, the index and the
settlement need: `threadId`, `userId`, `order`, `stepOrder`, `status`, `tool`,
`model`, `provider`, `finishReason`, `usage`, `warnings`, `fileIds`. The
content moves into one sealed payload for the learner who owns the chat, bound
to the field `{ table: "ninaMessages", field: "message", row: [threadId, order,
stepOrder] }`, so a payload opens only in the row it was sealed for. The payload
holds `message`, `reasoning`, `reasoningDetails`, `sources`, `providerMetadata`
and `error`, encoded with Convex's value-to-JSON so that bytes survive. The prompt
that a cancelled or failed turn marks failed keeps its `error`, which Nakafa
sets to `cancelled` or `failed` (`settlement.ts:75-82`). The row keeps a
skeleton of `message` that is valid for the component:

- the role is kept;
- every part keeps its type. A text or reasoning part keeps an empty text, so
  `text` is empty and `text_search` indexes nothing;
- a file or image part keeps its media type and, when it has one, its provider
  reference. Its address and its bytes stay in the payload, because an address of
  a stored file opens the file for anyone who holds it. A custom part keeps its
  kind, a source keeps its id and its source type, and a tool approval keeps its
  ids, with `approved` on a response;
- a tool-call part keeps `toolCallId` and `toolName` with an empty `input`, and
  a tool-result part keeps both with no `output`, because the Agent's validator
  rejects `null`, so the `tool` flag, the pairing of calls with results
  (`filterOutOrphanedToolMessages`) and `excludeToolMessages` keep working;
- the sealed bytes sit in `message.providerOptions.nakafa.sealed` as bytes,
  which the component's options validator (`v.any()`) holds, so a sealed row
  stays about as long as the plain row.

`reasoning`, `reasoningDetails`, `sources`, `providerMetadata` and `error` are
not passed to `addMessages`, so the row has none. A field of that list that a row
keeps in the clear beside its sealed bytes comes back as stored, such as the error
that a cut-off turn writes onto a prompt row (`journal.ts`). A field that both the
row and its sealed content hold fails the read, because neither value can be the
right one. A row that has no sealed bytes is read as plain. It is a running
turn's row, or a row of a settled turn that the seal has not reached yet, and the module passes it through, so a read
does not fail before its turn is sealed. The seal writes `sealedAt` in the same
transaction as the sealed rows, so a turn that carries it has no plain row unless
a write came from outside the seal. Such a row fails the read, because the read
must not hide it. The guard against a row that stays plain is the marker, the
sweep, and a test that plants strings in a whole turn and looks in every table.

### What Breaks In The Component

- `text_search` and any text search over messages find nothing, because the
  sealed rows have empty `text`. Nobody searches today.
- The Agent's own context fetch reads sealed skeletons. Suggestions and title
  use it and change, as below. Nina's main generation does not use it
  (`generation.ts:70-71`).
- `finalizeMessage` still writes a plain row from the deltas when a pending row
  has no content. The seal of the settled turn replaces it.
- `docsToModelMessages` on a sealed row gives a harmless, wrong skeleton, not
  plain text. The single module and the source rule below keep a reader from
  skipping the opening.
- The ids of a settled turn's assistant and tool rows change once, at
  settlement. Only the id passed to the renderer and the last-message check
  read them (`message/view.tsx:36`, `message/loading.tsx:20`); the transcript
  keys by thread, `order` and `stepOrder`.

## Readers After The Change

Every reader in the table above opens through the module, with one `vaultKeys`
read for the whole function.

| Reader | Documents read | Added | Decrypts |
| --- | --- | --- | --- |
| The page of messages | up to 50 rows and one turn row for each `order` | 1 key row | up to 50 |
| The next turn | 50 rows a page, back to the oldest uncovered turn | 1 | rows read |
| The summary job | 100 rows a page, text rows | 1 | rows read |
| Capture, retry, replay | 1 row | 1 | 1 |
| Attachments, a send | 1 file row for each attachment | 1, when a name is sealed | 1 name for each sealed name |
| Attachments, a retry's size check | 1 file row for each attachment | 0 | 0 |
| Suggestions | up to 16 rows, the window of `SUGGESTION_MESSAGES` (`presentation.ts`) | 1 | up to 16 |
| Title | 1 row: it runs for the first turn only (`presentation.ts:102`) | 1 | 1 |

A sealed row has an empty `text`, so the readers that used it take the text of
the opened message instead: the summary job (`summary.ts:114-118`), memory
capture (`memory/capture.ts:166`) and the replay of a turn start
(`turns.impl.ts:80-90`).

Suggestions and title stop using the Agent's own fetch. They set
`recentMessages: 0` and take their input from the module through
`contextHandler`, as `generation.ts:70-71` does. Otherwise the Agent would send
sealed skeletons to the model.

The next turn reads through an internal query of ours that calls the component
and opens inside it, so it makes the same single trip from the action that
`readDocs` makes now. The page query changes from `listUIMessages` to
`listMessages`, opening, and `toUIMessages`, which is what `listUIMessages`
does, so the shape the browser receives does not change. A source rule in
`scripts/check` should reject a call to `listMessagesByThreadId`,
`getMessagesByIds`, `listMessages`, `listUIMessages`, `docsToModelMessages` or
`getFile` outside the module, so a reader added later cannot skip the opening.

## Time To First Token

Nothing the learner waits for before the first token gets longer by a
noticeable amount.

- The admission mutation seals one message: one key read and one seal, about
  0.6 ms and 0.1 ms at best, inside a mutation the browser already shows
  optimistically.
- The next turn's history is opened before the model call and adds the key read
  and the opens in series. Four average turns are about 36 rows, which is about
  0.6 ms for the key and about 2 ms to open at best, and about 10 to 15 ms at
  the medians of this loaded machine. ADR 0019 measured a short plain chat call
  at 0.7 s on the faster model, so the addition is 0.4 percent at best and
  about 2 percent at the loaded medians.
- Streaming, the step saves and the first token do not change: deltas stay
  plain while they stream, and the seal runs after the answer is complete, so
  the learner sees the final answer first. The sealed rows replace the plain
  ones in one transaction.

## A Shared Chat

A sealed chat is opened for a reader the access rules allow, with the owner's
keys, exactly as its title is (`chats/title.ts`). A reader who holds the share
token of a chat (ADR 0001) gets the opened page; one who does not gets a chat
that does not exist. The token's hash, not the owner's key, decides who reads.

- Each viewer's query reads the owner's key row and derives the keys again,
  about 0.6 ms at best, and opens what its page holds.
- Turning sharing off deletes the token and ends every viewer's access at their
  next run of the query. Nothing in the sealed rows changes.
- Deleting the owner's account deletes the chat and shreds the owner's vault
  key, so sealed copies in old backups cannot be opened once every copy of the
  root key is destroyed. A rotation of the root key moves the wrapped learner
  keys and school keys (ADR 0030), and leaves every sealed row as it is.
- Sealing is not end-to-end. The server holds the key, and a viewer receives
  plain text by design. The honest limit stays what the blueprint says: someone
  who holds the environment and the data can open everything.

## Old Messages

Rows written before the change are plain, and the learner's row of each is
referenced by `ninaTurns.promptMessageId`. Those rows, and the attachments whose
names predate sealing, are retired data. The change removes them. No temporary
mutation, dry pass, or cursor migrates them, and no copy is written under a
sealed name.

## Order Of Work

Each wave is a pull request. Every wave from the second on has a test that
plants strings in the learner's message, the reasoning, the answer and a source,
runs a whole turn and searches every component table.

1. **Open both forms.** The module, the opening in every reader of the table
   above, suggestions and title off the Agent's fetch, the source rule. No
   behavior changes. Gate: each reader gives the same result for plain rows and
   for sealed rows.
2. **Seal the learner's message and the file name at write.** `turns.start`
   seals the learner's message, and its retry writes through the same path. A
   replay reads its stored row and writes nothing, and capture writes no learner
   message. The upload seals the file name before `storeFile`:
   `nina/uploads.impl.ts` seals it at reservation and records `nameSealed`, so the
   Agent stores the sealed name and never the plain one. Gate: after
   admission the message appears in no table, and a test that uploads a file with
   a planted name finds the name in no table, `files` included.
3. **Seal the settled turn.** The `seal` mutation, the `sealedAt` marker, the
   sweep and the early deletion of deltas. Gate: after settlement and the
   deletion of the deltas no planted string appears in any table; during the
   turn they appear only in the plain rows and the deltas.
4. **Old messages.** They are removed in the same change, as Old Messages says.
   Gate: no file row that a message refers to holds a plain name.

In parallel, a proposal to Convex for a codec hook in the component. If it ships,
the hook replaces wave 3, and wave 2 too if the hook covers `saveMessage`. The
module then keeps only the opening.

## What Stays Open

- The rows of a running turn, a failed turn until the sweep seals it, and the
  deltas are plain for as long as stated in the table of designs. A backup taken
  in that window holds them.
- The bytes of an uploaded file are not sealed by this plan. The file name of a
  chat attachment is sealed in program wave A (Decision 4).
- A file name stored before sealing that begins with the prefix looks sealed to a reader that has no upload record. No reader does this today: a send reads a name only for its own upload, and a retry reads none. A reader added later takes a name's state from a record, never from its prefix.
- Searching earlier chats for text is not possible over sealed rows. The summary
  and the memories carry what Nina recalls. If a search is wanted later, it
  follows ADR 0022: blind keys for words, no embeddings, because an embedding
  can be turned back into text.
- The model provider sees plain text for the length of a call. ADR 0019 covers
  retention.
- A seal that fails is counted on its turn. Under the production budget it ends its
  run, so a broken turn delays the turns behind it by at most `SEAL_TRIES` runs. It
  is tried again in later runs until `SEAL_TRIES` failures hold it, and then it stays
  plain for good. Until a person fixes the fault, every such turn keeps its plain
  rows, which the reader still opens. A failure of the settlement's own zero-delay `seal` is not counted:
  the sweep's next try is the one that counts. Convex logs each failed scheduled
  `seal` with its turn id, and the drain logs each failed try with its turn and its
  cause. Such a failure is a defect to fix, not a state to accept.
  A turn that the seal skips while its chat or its learner is being deleted is held
  at once, with `chatDeleted` or `accountDeleted`, and the deletion removes its
  turns. That deletion starts at once: the chat trigger schedules its cleanup at zero delay
  (`triggers/chats/chats.ts`), the cleanup deletes the turns
  (`triggers/chats/cleanup.impl.ts`), and the account deletion launches its
  cleanup at zero delay (`auth/deletion/finalize.ts`). The pause lasts as long as
  that deletion takes.
- A run that writes a row into a turn after the seal leaves that row plain. A
  cancelled or failed settlement cuts off the turn's streams (`journal.ts`), and
  the seal aborts any stream still open at the turn's order before it reads the
  streams, which stops the known writers. The reader fails a plain row of a
  sealed turn.

## Implementation Status

| Part | Status |
| --- | --- |
| `packages/backend/confect/nina/sealed.ts`: seals a message's content into a skeleton row, and opens it only for its own thread, order and step. The field binds the row through `row` in `vault/text.ts`, so existing learner bindings do not change. | Built in program wave A, order of work step 1 (slice S1a). The readers open through it in S1b and S1c, and the writers seal in wave two. |
| `packages/backend/confect/nina/sealed/`: the reads of stored rows and files, and the two writers of the row below, `save.ts` (`savePrompt`) and `file.ts` (`sealFileName`). `thread.ts` reads a page of a thread, `message.ts` one message by id, `file.ts` a stored file (`getStoredFile`, `readFile`), whose name opens only when its upload sealed it, `model.ts` converts opened rows to model messages, `action.ts` reads from an action through the module's own internal queries (`sealed.spec.ts`, `sealed.impl.ts`), and `context.ts` gives the recent context of suggestions and the prompt of the title. `open.ts` opens the rows of one read for the owner it is given: a read of plain rows reads no key, and a read with a sealed row reads the owner's key once. | Built in S1b. Each read names the owner whose key opens it: the chat's owner, the turn's learner, or the learner who asks for a memory. |
| Readers that open through the module. Each has a parity test, in which the same thread gives the same result plain, written by the writers (`writtenThreadIn`), and sealed in place (`sealThreadIn`, `test/nina/seal.ts`). The replay of a turn start and the attachment retry also run a plain copy of the chat (`plainThreadIn`): the page (`messages/page.ts`), the list (`messages.impl.ts`), the next turn's history (`uncovered.ts`), the summary's writer input and its summary (`summary.ts`), memory capture's words of a turn (`memory/said.ts`), the replay of a turn start (`turns.impl.ts`), the settlement check of the newest row (`journal.ts`), retry of a sealed prompt with its attachment (`prompt.ts`, `attachments.ts`), the brief's prompt (`brief.impl.ts`), and the suggestions' and the title's model input (`presentation.ts`, with the sealed window of `sealed/context.ts`). Attachment file names are sealed from step 2 for every new upload; the names stored before step 2 are removed by the sealing change (Old Messages). The admission opens the row that the writer stores, through `savePrompt` (`sealed/save.ts`, the row below). The CLI journal gate (`packages/backend/scripts/nina/deployment.ts`) stays as it is: it reads only the status, the agent name, the finish reason, the usage and the role of each row (`scripts/nina/verdict.ts`), none of them sealed. | Built in S1b and S1c. |
| Agent audit. Suggestions and title set `recentMessages: 0` and take their input from the module through `contextHandler`, as `generation.ts` already did. Every other Agent call (`math/agent.ts`, `math/repair.ts`, `memory/capture.ts`, `nakafa/agent.ts`, `portrait/build.ts`, `repair.ts`, the two calls of `research/agent.ts`, `summary.ts`, and the test helper `test/nina/capability.ts`) passes `userId` and no `threadId`, so its fetch of recent messages cannot run. Every `generateText`, `streamText`, `generateObject` and `streamObject` call of the backend goes through one of these Agents. | Built in S1b. |
| `scripts/check/sealed.ts`, the source rule of ADR 0021 (Sealed message readers): no load of the Agent package that reaches one of its readers of stored rows and files (an import, a re-export, a namespace import, or a dynamic import), and no read of the component's messages that returns sealed rows as they are (a property, an element, a destructuring, or the messages taken as a value), in every authored module outside the sealed module. Type-only specifiers read nothing. Tests and the helpers under `packages/backend/test/` read the stored form on purpose and are not judged. | Built in S1b, with its tests and a planted violation of each form. |
| The writers of step 2. `sealed/save.ts` (`savePrompt`) seals a learner's message at its place: it reads the newest row of the thread across every status and tool flag, and takes the next order with step 0, as the Agent does for a user message. It serializes the message, seals it with the learner's key bound to that row, saves it through the Agent's `saveMessage` with the explicit order, and opens the stored row. `turns.start` is its only caller: the admission, and the retry, which sends the stored prompt again. A replayed request reads its row and writes nothing, and `memory/capture.ts` writes no learner message (it reads one through `memory/said.ts`). `sealed/file.ts` (`sealFileName`) seals a new upload's name, and `nina/uploads.impl.ts` seals it inside `reserve`, before `storeFile` stores the file, and records `nameSealed` on the upload, so the component never sees the plain name. `sealed/file.ts` (`readFile`) opens a name only for an upload that sealed it, and the retry's size check reads the storage entry alone. Built in step 2. | Built in step 2. Gates: `turns.impl.test.ts` (no table of the component holds the planted prompt after admission), `uploads.impl.test.ts` (no table holds a planted name, `files` included), `sealed/save.test.ts`, `sealed/file.test.ts`, and `attachments.test.ts` (a retry opens no name, and a send opens a name only for a sealed upload, with one key read). |
| The settled turn's seal, order of work step 3. `sealed/turn.ts` (`sealTurn`) seals the assistant and tool rows of a settled turn at the steps they take, with the same order, and deletes its streams' deltas with `deleteStreamAsync`, in one transaction that records `sealedAt`. `sealed.spec.ts` and `sealed.impl.ts` expose it as the internal mutation `seal`, which `settlement.ts` schedules at zero delay for every outcome. `sealTurn` returns the bytes it counted (`sealed/bytes.ts`). `sealed/drain.ts` seals the unsealed settled turns oldest first within the byte budget of a run, which `sweep.ts` derives from the cadence (`SEAL_BYTES_PER_SWEEP`): the drain is an action and each seal is its own transaction. It finds the turns through the index `by_phase_and_sealedAt_and_sealHold` (`tables/ninaTurns.ts`), which the drain reads a page at a time. It records a failed seal on its turn, holds a turn after `SEAL_TRIES` failures or at a skip on purpose, passes a turn with a young pending row by without counting a failure, seals an older pending row as failed, and stops a run at once at `SealUnavailable`, the unreadable key ring. Otherwise a run also ends when the next seal's reserve does not fit the budget, which under the production budget happens after any failed seal (The Seal And The Sweep Bound). `turns.spec.ts` adds the optional `sealedAt`, `sealAttempts`, `sealFailedAt` and `sealHold` of a settled turn. The keyed request fingerprint (Decision 5) is `nina/fingerprint.ts`, which `turns.impl.ts` stores with the turn, and `savePrompt` takes the learner's keys from the admission, so one key read serves the admission. A stream that still streams at the turn's order is aborted first, as settlement aborts it. Gates: `sealed/turn.test.ts` (including the turns the seal skips on purpose, and the gate: planted strings in the learner's message, the reasoning, the answer, a tool input, a tool output, a source and the name of an upload, and no planted string in any component table, files included, after settlement and the deletion of the deltas, with the learner's page and the module's thread reader unchanged; a failed and a cancelled turn; a retried seal; a deleted turn, chat, account and prompt; a seal that reads the learner's key once, a pinned count of its bytes, and a young pending row, which waits for a later run, and an old one, which is sealed as failed), `sealed/rows.test.ts` (a turn of more than one page of rows, a turn with no rows above its prompt, and a component that stores fewer rows, or the sealed rows at other steps, where nothing is written), `sealed/drain.test.ts` (the first seal always runs, the reserve stops a run before its budget is spent, a budget that covers every turn seals them all, the sweep's own budget seals three short turns, a failed seal is counted, logged with its cause and rolled back, the turns behind it still seal, a turn is held after `SEAL_TRIES` failures, a run goes on past any number of failures, a failed seal costs one reserve, an unreadable key ring stops a run with one log, a held or chat-deleted turn is passed by, a sealed, held, running or gone turn is not counted, the drain reads candidates a page at a time, and the reserve covers the long shape), `sealed/bytes.test.ts` (the counted sizes of text, binary and nested values), `fingerprint.test.ts` (the fingerprint is keyed to the learner, is not an unkeyed hash of the request, and is the value the admission stores), `sweep.test.ts` (the sweep schedules one drain with the run's budget, and seals old turns that still hold plain rows, leaving a sealed one alone), and `generation.test.ts`, whose transcript read goes through the learner's page. Built in step 3 and verified against `@convex-dev/agent` 0.7.8, the installed version; the spike read 0.7.7. |
