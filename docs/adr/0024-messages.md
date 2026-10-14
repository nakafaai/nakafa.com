# ADR 0024: Nina Messages Are Sealed By Replacing The Rows Of A Settled Turn

## Status

Accepted after the sealing spike of 12 October 2026. It decides the design and
the order of work. The title, the summary, and the memory are sealed and live.
The other stages in Decision are planned for program wave A, the first delivery
wave of the School program, and are not live yet.

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
| `messages` | the learner's message; a pending assistant row when generation starts (`saveInputMessages.ts:88-93`), which the first step replaces; then one assistant row per step and one tool row per step that called tools | Yes, in the fields below | The learner's message by Nakafa (`turns.impl.ts:144`). Every later row by the Agent client at the end of each step (`start.ts:384`, `messages.ts:224-433`). |
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
tokens before the model reads it (`budget.ts:10-11`). The dry pass of the
migration below reports the real rows and bytes before anything is rewritten.
The measurements cover the cost of the cipher only. The cost of reading and
writing documents is counted in documents, because the test database says
nothing about it.

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
   (`turns.impl.ts:144`). No plain copy of the learner's message ever rests in
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
   through an index on the turn's phase and `sealedAt`, which order-of-work step 3
   adds. The seal skips a turn that already carries `sealedAt`, so a retry is
   safe, and a seal that fails leaves the turn plain and readable until the next
   sweep run.
3. **One module owns the form, and every reader opens through it.** A reader
   gets rows from the module and never from the component.
4. **Chat attachments.** The file name of a chat attachment, the `files.filename`
   field that the component keeps, is sealed with the learner's key in program
   wave A. The component has no way to change a file's name, and the storage
   sweep deletes a file's bytes with its row, so an attachment written before
   wave A is copied: the old-message migration (order of work, step 4) stores a
   copy of its bytes, registers the copy with the sealed name through `addFile`,
   and writes the replaced message with the new file id. The old row loses its
   last reference, and the sweep removes it and its bytes as for any unused
   file. The module that owns the sealed form opens a file's name too: the
   attachments reader takes the file through it and gets the part with its name
   opened, so neither the model's file part, the admission receipt, nor the page
   sees the sealed form. A file part inside a message row is sealed and opened
   with its row. The dry run reports how many attachments and bytes it would copy. The
   stored file is removed within two days of its chat's deletion, as
   the live policy already says (ADR 0001). The cleanup runs once a day, and it
   removes a file once no chat refers to it and 24 hours have passed since its
   last reference changed. This plan does not seal the bytes of an upload. A new
   upload seals its name at upload, before the component stores the file (order
   of work, step 2).

The stages, and the key that seals each one (owner decisions K2, K3, and K10):

| Stage | Sealed with | Status |
| --- | --- | --- |
| Title, summary, and memory | The learner's key | Live |
| The learner's message, at send | The learner's key | Planned, wave A |
| The rows of a running turn | Not sealed while the turn runs | Plain, by design |
| The private reply and tool rows, once the turn settles, in one transaction | The learner's key | Planned, wave A |
| A failed or cancelled prompt, at turn end by the sweep | The learner's key | Planned, wave A |
| Stream deltas | Not sealed; deleted after the turn | Planned, wave A |
| Old messages, by migration | The learner's key | Planned, wave A |
| Chat attachment file names | The learner's key | Planned, wave A |
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
to the field `{ table: "ninaMessages", field: "message" }`. The payload holds
`message`, `reasoning`, `reasoningDetails`, `sources`, `providerMetadata` and
`error`, encoded with Convex's value-to-JSON so that bytes survive. The prompt
that a cancelled or failed turn marks failed keeps its `error`, which Nakafa
sets to `cancelled` or `failed` (`settlement.ts:75-82`). The row keeps a
skeleton of `message` that is valid for the component:

- the role is kept;
- a text row has empty `content`, so `text` is empty and `text_search` indexes
  nothing;
- a tool-call part keeps `toolCallId` and `toolName` with an empty `input`, and
  a tool-result part keeps both with a `null` `output`, so the `tool` flag, the
  pairing of calls with results (`filterOutOrphanedToolMessages`) and
  `excludeToolMessages` keep working;
- the sealed bytes sit in `message.providerOptions.nakafa.sealed`.

`reasoning`, `reasoningDetails`, `sources`, `providerMetadata` and `error` are
not passed to `addMessages`, so the row has none. A row that has no sealed
bytes is read as plain. It is a running turn's row, or a row of a settled turn
that the seal has not reached yet, and the module passes it through, so a read
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
| Attachments | 1 file row for each attachment | 1 | 1 name for each |
| Suggestions | up to 50 rows | 1 | up to 50 |
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
  root key is destroyed. A rotation of the root key moves only the wrapped
  learner keys and leaves every sealed row as it is.
- Sealing is not end-to-end. The server holds the key, and a viewer receives
  plain text by design. The honest limit stays what the blueprint says: someone
  who holds the environment and the data can open everything.

## Old Messages

Rows written before the change are plain, and the learner's row of each is
referenced by `ninaTurns.promptMessageId`. A temporary internal mutation
migrates them, with a dry pass, as the migrations before it did:

1. It reads one chat per call, by creation time and a cursor, and one page of
   its rows. A turn that is still active is skipped.
2. The learner's row is sealed in place with `updateMessage`, which keeps its
   id. The assistant and tool rows of the turn are replaced as at settlement.
3. A row that is sealed already is left alone, so a call can run again.
4. The dry pass writes nothing. It reports chats, turns, rows and bytes by form,
   so production can be counted before anything is rewritten, and the assumed
   sizes above can be replaced with real ones.

It runs on dev and on production until a whole pass finds no settled turn that
still has a plain row, and it is deleted afterwards with its tests. The reader
rule of the Sealed Row section holds through the migration: a plain row of a turn
that carries `sealedAt` fails the read, and the plain rows of a running turn and
of a settled turn without the marker pass through.

## Order Of Work

Each wave is a pull request. Every wave from the second on has a test that
plants strings in the learner's message, the reasoning, the answer and a source,
runs a whole turn and searches every component table.

1. **Open both forms.** The module, the opening in every reader of the table
   above, suggestions and title off the Agent's fetch, the source rule. No
   behavior changes. Gate: each reader gives the same result for plain rows and
   for sealed rows.
2. **Seal the learner's message and the file name at write.** `turns.start`,
   replay, retry and capture seal the message. The upload seals the file name
   before `storeFile`: `nina/uploads.impl.ts` passes the plain name to `storeFile`
   today, and the Agent forwards it unchanged to the component. Gate: after
   admission the message appears in no table, and a test that uploads a file with
   a planted name finds the name in no table, `files` included.
3. **Seal the settled turn.** The `seal` mutation, the `sealedAt` marker, the
   sweep and the early deletion of deltas. Gate: after settlement and the
   deletion of the deltas no planted string appears in any table; during the
   turn they appear only in the plain rows and the deltas.
4. **Old messages.** The migration, run dry, then run for real on dev and on
   production, then run again until it reports nothing. It also copies each
   attachment of an old message under its sealed name (Decision, item 4). The dry
   run counts old attachments only, because every upload since step 2 is sealed at
   upload. Gate: no file row that a message refers to holds a plain name.
5. **Contract.** Delete the migration and its tests. The reader rule of the Sealed
   Row section stays: a plain row of a turn that carries `sealedAt` fails the
   read, and a running turn or a settled turn without the marker keeps its plain
   rows readable.

In parallel, a proposal to Convex for a codec hook in the component. If it ships,
the hook replaces wave 3, and wave 2 too if the hook covers `saveMessage`. The
module then keeps only the opening.

## What Stays Open

- The rows of a running turn, a failed turn until the sweep seals it, and the
  deltas are plain for as long as stated in the table of designs. A backup taken
  in that window holds them.
- The bytes of an uploaded file are not sealed by this plan. The file name of a
  chat attachment is sealed in program wave A (Decision 4).
- Searching earlier chats for text is not possible over sealed rows. The summary
  and the memories carry what Nina recalls. If a search is wanted later, it
  follows ADR 0022: blind keys for words, no embeddings, because an embedding
  can be turned back into text.
- The model provider sees plain text for the length of a call. ADR 0019 covers
  retention.
