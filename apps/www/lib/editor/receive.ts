import { decodeStep } from "@repo/backend/confect/editor/step";
import type { StepView } from "@repo/backend/confect/editor/view";
import { JsonTextSchema } from "@repo/utilities/json";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { ReplaceStep, Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import {
  getVersion,
  receiveTransaction,
  sendableSteps,
} from "prosemirror-collab";
import {
  nowTime,
  SyncDropped,
  SyncFailed,
  type SyncSession,
} from "@/lib/editor/session";

/**
 * The client id that no editor has. The collab plugin takes a step under this id as
 * another editor's, so every server step is rebased as a remote one. A client id is
 * never empty (`ClientIdSchema`), so no editor carries it.
 */
const NO_CLIENT = "";

/**
 * A step that changes nothing: it replaces no content, at the start of any
 * document. The collab plugin counts a step in a version, so a stored step that is
 * skipped is passed on as this one, and the version still moves by one.
 */
const SKIPPED = new ReplaceStep(0, 0, Slice.empty);

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
 * The document after one step, or nothing when the step does not apply. A step
 * that fails, and a step whose positions lie outside the document, which throws,
 * both do not apply.
 */
const applyStep = Effect.fn("editor.sync.applyStep")(function* (
  doc: Node,
  step: Step
) {
  const result = yield* Effect.try({
    try: () => step.apply(doc),
    catch: () => null,
  }).pipe(Effect.option);
  return Option.flatMap(result, (applied) => Option.fromNullishOr(applied.doc));
});

/**
 * The server's document after the steps, and the steps the collab plugin receives
 * in their place. A step that does not apply to the server's document is skipped
 * for every editor, so they all keep the same document, and the skip is logged. The
 * skipped step stays in the list as a step that changes nothing, so the version
 * counts it.
 */
const settle = Effect.fn("editor.sync.settle")(function* (
  server: Node,
  steps: readonly (readonly [Step, typeof StepView.Type])[]
) {
  return yield* Effect.reduce(
    steps,
    () => ({ doc: server, received: Arr.empty<Step>() }),
    (settled, [step, view]) =>
      Effect.gen(function* () {
        const next = yield* applyStep(settled.doc, step);
        if (Option.isSome(next)) {
          return {
            doc: next.value,
            received: Arr.append(settled.received, step),
          };
        }
        yield* Effect.logWarning(
          `The stored step at version ${view.version} does not apply to the document, so every editor skips it.`
        );
        return {
          doc: settled.doc,
          received: Arr.append(settled.received, SKIPPED),
        };
      })
  );
});

/**
 * Applies the steps the server returned, in order, through the collab plugin: the
 * editor's own steps confirm its unconfirmed ones, and the others are rebased over
 * them. The head moves to the server's head, and an edit by another editor counts
 * as a change for the idle rule. A reply whose steps do not follow the editor's
 * version is refused before any of it applies, so no step is applied twice or
 * skipped. `confirmOwn` says whether a step under this editor's id confirms one of
 * its unconfirmed steps; a reopened editor passes false, because the steps it held
 * are the ones it replays.
 */
export const applySteps = Effect.fn("editor.sync.apply")(function* (
  session: SyncSession,
  steps: readonly (typeof StepView.Type)[],
  head: number,
  confirmOwn: boolean
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
  const memory = yield* Ref.get(session.memory);
  const parsed = yield* Effect.forEach(steps, (view) =>
    readStep(session.port.schema, view.step)
  );
  const server = yield* Ref.get(session.server);
  const settled = yield* settle(server, Arr.zip(parsed, steps));
  yield* Ref.set(session.server, settled.doc);
  // The settled steps apply to the base that the collab plugin rebases over, so a throw
  // here is a defect, and it is not a refusal of the server's steps.
  const transaction = receiveTransaction(
    state,
    settled.received,
    Arr.map(steps, (view) => (confirmOwn ? view.clientId : NO_CLIENT))
  );
  yield* session.port.dispatch(transaction);
  if (Arr.some(steps, (view) => view.clientId !== memory.clientId)) {
    const now = yield* nowTime;
    yield* Ref.update(session.memory, (current) => ({
      ...current,
      lastChangeAt: now,
    }));
  }
});

/**
 * Adds a step to a transaction when the step applies, and says whether it did. A
 * step that does not apply, or that throws, is left out of the transaction.
 */
const addStep = Effect.fn("editor.sync.addStep")(function* (
  transaction: Transaction,
  step: Step
) {
  const result = yield* Effect.try({
    try: () => transaction.maybeStep(step),
    catch: () => null,
  }).pipe(Effect.option);
  return Option.exists(result, (applied) => applied.failed === null);
});

/**
 * Puts the steps this editor still holds on the document it has just opened, as
 * unconfirmed steps of that version, in order. A step that does not apply to the
 * document is dropped. The transaction is marked as rebased, so the depth guard of
 * the editor does not refuse what the editor already held. Returns how many steps
 * were dropped.
 */
const replay = Effect.fn("editor.sync.replay")(function* (
  session: SyncSession,
  steps: readonly Step[]
) {
  const transaction = (yield* session.port.state).tr;
  const kept = yield* Effect.forEach(steps, (step) =>
    addStep(transaction, step)
  );
  const applied = Arr.filter(kept, (ok) => ok).length;
  if (applied > 0) {
    yield* session.port.dispatch(transaction.setMeta("rebased", applied));
  }
  return kept.length - applied;
});

/** How many steps the editor holds unconfirmed. */
const unconfirmedCount = (state: EditorState) =>
  sendableSteps(state)?.steps.length ?? 0;

/**
 * Opens the document again from its snapshot, when the log no longer keeps the steps
 * this editor needs. The editor's own batch is confirmed and dropped when the server
 * says it landed, and the rest of the editor's unconfirmed steps are replayed onto
 * the snapshot, as unconfirmed steps of its version. The server's steps after the
 * snapshot then rebase them, as they rebase any unconfirmed step. The editor reports
 * the steps that did not survive, once.
 */
const reopen = Effect.fn("editor.sync.reopen")(function* (
  session: SyncSession
) {
  const memory = yield* Ref.get(session.memory);
  const held = sendableSteps(yield* session.port.state)?.steps ?? [];
  const opened = yield* session.transport.open(memory.clientId);
  const landedCount = Option.match(memory.batch, {
    onNone: () => 0,
    onSome: (batch) => (opened.client?.batch === batch.id ? batch.count : 0),
  });
  const doc = yield* readDocument(session.port.schema, opened.snapshot.content);
  yield* session.port.replace({
    clientId: memory.clientId,
    doc,
    version: opened.snapshot.version,
  });
  yield* Ref.set(session.server, doc);
  const now = yield* nowTime;
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.none(),
    snapshotAt: Option.some(now),
    snapshotVersion: opened.snapshot.version,
  }));
  const replayDropped = yield* replay(session, Arr.drop(held, landedCount));
  const replayed = unconfirmedCount(yield* session.port.state);
  yield* applySteps(session, opened.steps, opened.head, false);
  const rebaseDropped = replayed - unconfirmedCount(yield* session.port.state);
  const dropped = replayDropped + rebaseDropped;
  return dropped === 0
    ? Option.none<SyncDropped>()
    : Option.some(new SyncDropped({ count: dropped }));
});

/**
 * Takes the server's steps after this editor's version. A `behind` reply means the
 * log no longer keeps the first step this editor needs, so the document is opened
 * again from its snapshot. The result is the count of steps this editor lost, when
 * it lost any.
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
  yield* applySteps(session, reply.steps, reply.head, true);
  return Option.none<SyncDropped>();
});
