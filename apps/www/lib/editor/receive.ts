import { decodeStep } from "@repo/backend/confect/editor/step";
import type {
  ClientRecordView,
  StepView,
} from "@repo/backend/confect/editor/view";
import { JsonTextSchema } from "@repo/utilities/json";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { ReplaceStep, Step, type StepResult } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import {
  getVersion,
  receiveTransaction,
  sendableSteps,
} from "prosemirror-collab";
import {
  type Memory,
  nowTime,
  StepRejected,
  SyncFailed,
  type SyncSession,
} from "@/lib/editor/session";

/**
 * A step that changes nothing: it replaces no content, at the start of any
 * document. The collab plugin counts a step in a version, so a stored step that is
 * skipped is passed on as this one, and the version still moves by one.
 */
const SKIPPED = new ReplaceStep(0, 0, Slice.empty);

/** The outcome of replacing an editor's state: the steps the replay refused, and the unconfirmed steps the rebase dropped. */
const Replacement = Schema.Struct({
  rebaseDropped: Schema.Natural,
  refused: Schema.Array(StepRejected),
});

/** Reads a document from its JSON text into a ProseMirror node of the schema. */
export const readDocument = Effect.fn("editor.sync.document")(function* (
  schema: ProseSchema,
  content: string
) {
  const json = yield* Schema.decodeEffect(JsonTextSchema)(content).pipe(
    Effect.orDie
  );
  return yield* Effect.try({
    try: () => schema.nodeFromJSON(json),
    catch: () =>
      new SyncFailed({ reason: "The snapshot does not fit the schema." }),
  });
});

/** Reads one stored step into a ProseMirror step of the schema. */
const readStep = Effect.fn("editor.sync.step")(function* (
  schema: ProseSchema,
  text: string
) {
  const json = yield* decodeStep(text).pipe(Effect.orDie);
  return yield* Effect.try({
    try: () => Step.fromJSON(schema, json),
    catch: () => new SyncFailed({ reason: "A step does not fit the schema." }),
  });
});

/** Whether the steps follow the version one by one, starting with the version after it. */
const followsVersion = (
  version: number,
  steps: readonly (typeof StepView.Type)[]
) => Arr.every(steps, (view, index) => view.version === version + index + 1);

/**
 * Calls ProseMirror for one step and turns its answer into the step's outcome. A
 * refusal by ProseMirror, and a throw of ProseMirror, such as a position outside the
 * document, both fail with `StepRejected`, and each keeps its reason. Any other answer
 * is the step's result.
 */
const stepOutcome = Effect.fn("editor.sync.outcome")(function* (
  run: () => StepResult
) {
  const result = yield* Effect.try({
    try: run,
    catch: (cause) => new StepRejected({ reason: String(cause) }),
  });
  if (result.failed !== null) {
    return yield* new StepRejected({ reason: result.failed });
  }
  return result;
});

/**
 * The document after one stored step, or the reason the step does not apply. ProseMirror
 * gives a document for every step that does not fail, so a missing document is a defect.
 */
const applyStep = Effect.fn("editor.sync.applyStep")(function* (
  doc: Node,
  step: Step
) {
  const result = yield* stepOutcome(() => step.apply(doc));
  return yield* Effect.fromNullishOr(result.doc).pipe(Effect.orDie);
});

/**
 * The server's document after the steps, and the steps the collab plugin receives in
 * their place. A step that does not apply to the server's document is skipped for
 * every editor, so they all keep the same document, and the skip is logged with its
 * reason. The skipped step stays in the list as a step that changes nothing, so the
 * version counts it.
 */
const settle = Effect.fn("editor.sync.settle")(function* (
  server: Node,
  steps: readonly (readonly [Step, typeof StepView.Type])[]
) {
  return yield* Effect.reduce(
    steps,
    () => ({ doc: server, received: Arr.empty<Step>() }),
    (settled, [step, view]) =>
      applyStep(settled.doc, step).pipe(
        Effect.map((doc) => ({
          doc,
          received: Arr.append(settled.received, step),
        })),
        Effect.catchTag("StepRejected", (refusal) =>
          Effect.logWarning(
            `The stored step at version ${view.version} does not apply to the document, so every editor skips it: ${refusal.reason}`
          ).pipe(
            Effect.as({
              doc: settled.doc,
              received: Arr.append(settled.received, SKIPPED),
            })
          )
        )
      )
  );
});

/**
 * Reads the server's steps and settles them on the server's document, which they
 * follow. The result is the server's document after them, and the steps the editor's
 * state receives, one for each step of the reply.
 */
export const settleSteps = Effect.fn("editor.sync.settleSteps")(function* (
  schema: ProseSchema,
  server: Node,
  steps: readonly (typeof StepView.Type)[]
) {
  const parsed = yield* Effect.forEach(steps, (view) =>
    readStep(schema, view.step)
  );
  return yield* settle(server, Arr.zip(parsed, steps));
});

/**
 * The state after the settled steps, built from the state it is given. The steps
 * whose client id is `clientIDs` confirm the editor's unconfirmed steps, and the
 * others are rebased over them. A reopened editor passes no client ids, because the
 * steps it held are the ones it replays.
 */
export const receiveOnto = (
  state: EditorState,
  received: readonly Step[],
  clientIDs: readonly string[]
): EditorState => state.apply(receiveTransaction(state, received, clientIDs));

/** How many steps the editor holds unconfirmed. */
const unconfirmedCount = (state: EditorState) =>
  sendableSteps(state)?.steps.length ?? 0;

/** An edit by another editor counts as a change, so the idle time of this editor starts over. */
const markChanged = Effect.fn("editor.sync.changed")(function* (
  session: SyncSession,
  steps: readonly (typeof StepView.Type)[]
) {
  const memory = yield* Ref.get(session.memory);
  if (Arr.some(steps, (view) => view.clientId !== memory.clientId)) {
    const now = yield* nowTime;
    yield* Ref.update(session.memory, (current) => ({
      ...current,
      lastChangeAt: now,
    }));
  }
});

/**
 * Applies the settled steps to the editor's state, as one change. The change is
 * built on the state that was read, and it is dispatched only while the editor still
 * holds that state. When an edit landed in between, the change is built again on the
 * state the editor holds now, so the edit is rebased and never lost.
 */
const dispatchReceived = Effect.fn("editor.sync.dispatch")(function* (
  session: SyncSession,
  received: readonly Step[],
  clientIDs: readonly string[]
): Effect.fn.Return<void, never> {
  const from = yield* session.port.state;
  const applied = yield* session.port.dispatch(
    from,
    receiveTransaction(from, received, clientIDs)
  );
  if (!applied) {
    return yield* dispatchReceived(session, received, clientIDs);
  }
});

/**
 * Applies the steps the server returned, in order. The server's document takes them
 * first, then the editor's state does, through the collab plugin: the editor's own
 * steps confirm its unconfirmed ones, and the others are rebased over them. The head
 * moves to the server's head, and an edit by another editor counts as a change for the
 * idle rule. A reply whose steps do not follow the editor's version is refused before
 * any of it applies, so no step is applied twice or skipped.
 */
const applySteps = Effect.fn("editor.sync.apply")(function* (
  session: SyncSession,
  steps: readonly (typeof StepView.Type)[],
  head: number
) {
  const state = yield* session.port.state;
  if (!followsVersion(getVersion(state), steps)) {
    return yield* new SyncFailed({
      reason: "The server's steps do not follow this editor's version.",
    });
  }
  yield* Ref.update(session.memory, (current) => ({ ...current, head }));
  if (steps.length === 0) {
    return;
  }
  const server = yield* Ref.get(session.server);
  const settled = yield* settleSteps(session.port.schema, server, steps);
  yield* dispatchReceived(
    session,
    settled.received,
    Arr.map(steps, (view) => view.clientId)
  );
  yield* Ref.set(session.server, settled.doc);
  yield* markChanged(session, steps);
});

/**
 * Adds a step to a transaction when it applies. A step that does not apply is
 * refused with its reason, and it is left out of the transaction.
 */
const addStep = Effect.fn("editor.sync.addStep")(function* (
  transaction: Transaction,
  step: Step
) {
  yield* stepOutcome(() => transaction.maybeStep(step));
});

/**
 * The state of a fresh editor with the steps it held replayed on it, as unconfirmed
 * steps of its version, in order. A step that does not apply is refused, and the
 * refusals are returned, so the caller reports them. The transaction is marked as
 * rebased, so the depth guard of the editor does not refuse what the editor held.
 */
const replayOnto = Effect.fn("editor.sync.replay")(function* (
  state: EditorState,
  steps: readonly Step[]
) {
  const transaction = state.tr;
  const [, refused] = yield* Effect.partition(steps, (step) =>
    addStep(transaction, step)
  );
  return {
    refused,
    state: state.apply(
      transaction.setMeta("rebased", steps.length - refused.length)
    ),
  };
});

/**
 * The count of the editor's batch that landed, when the server's record of the
 * session names that batch: its steps are on the server, so the reopened editor
 * does not replay them.
 */
const landedCount = (
  memory: typeof Memory.Type,
  client: typeof ClientRecordView.Type
): number =>
  Option.match(memory.batch, {
    onNone: () => 0,
    onSome: (batch) => (client?.batch === batch.id ? batch.count : 0),
  });

/**
 * Replaces the editor's state with a fresh one on the snapshot. That state holds the
 * steps the editor held, replayed on it, and then the server's steps after the
 * snapshot, rebased over them. The editor's state is read and replaced as one change,
 * so an edit that lands while the snapshot is read is among the steps replayed. When
 * an edit lands before the replacement, the replacement is built again on the state
 * the editor holds now.
 */
const reseat = Effect.fn("editor.sync.reseat")(function* (
  session: SyncSession,
  snapshot: {
    readonly clientId: string;
    readonly doc: Node;
    readonly landed: number;
    readonly received: readonly Step[];
    readonly version: number;
  }
): Effect.fn.Return<typeof Replacement.Type, never> {
  const from = yield* session.port.state;
  const held = Arr.drop(sendableSteps(from)?.steps ?? [], snapshot.landed);
  const replayed = yield* replayOnto(
    session.port.fresh({
      clientId: snapshot.clientId,
      doc: snapshot.doc,
      version: snapshot.version,
    }),
    held
  );
  const rebased = receiveOnto(replayed.state, snapshot.received, []);
  const replaced = yield* session.port.replace(from, rebased);
  if (!replaced) {
    return yield* reseat(session, snapshot);
  }
  return {
    rebaseDropped: unconfirmedCount(replayed.state) - unconfirmedCount(rebased),
    refused: replayed.refused,
  };
});

/**
 * Opens the document again from its snapshot, when the log no longer keeps the steps
 * this editor needs. The editor's batch is confirmed and dropped when the server says
 * it landed. The rest of the editor's unconfirmed steps are replayed on the snapshot,
 * and the server's steps after it rebase them. The steps that did not survive are
 * counted for the next report, and each refused step is logged with its reason.
 */
const reopen = Effect.fn("editor.sync.reopen")(function* (
  session: SyncSession
) {
  const memory = yield* Ref.get(session.memory);
  const opened = yield* session.transport.open(memory.clientId);
  const doc = yield* readDocument(session.port.schema, opened.snapshot.content);
  const settled = yield* settleSteps(session.port.schema, doc, opened.steps);
  const replaced = yield* reseat(session, {
    clientId: memory.clientId,
    doc,
    landed: landedCount(memory, opened.client),
    received: settled.received,
    version: opened.snapshot.version,
  });
  yield* Effect.forEach(
    replaced.refused,
    (refusal) =>
      Effect.logWarning(
        `A step of this editor does not apply to the document it opened again from, so it is dropped: ${refusal.reason}`
      ),
    { discard: true }
  );
  const now = yield* nowTime;
  yield* Ref.set(session.server, settled.doc);
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.none(),
    dropped: current.dropped + replaced.refused.length + replaced.rebaseDropped,
    head: opened.head,
    snapshotAt: Option.some(now),
    snapshotVersion: opened.snapshot.version,
  }));
  yield* markChanged(session, opened.steps);
});

/**
 * Takes the server's steps after this editor's version. A `behind` reply means the
 * log no longer keeps the first step this editor needs, so the document is opened
 * again from its snapshot.
 */
export const pull = Effect.fn("editor.sync.pull")(function* (
  session: SyncSession
) {
  const memory = yield* Ref.get(session.memory);
  const state = yield* session.port.state;
  const reply = yield* session.transport.since(
    memory.clientId,
    getVersion(state)
  );
  if (reply._tag === "behind") {
    return yield* reopen(session);
  }
  yield* applySteps(session, reply.steps, reply.head);
});
