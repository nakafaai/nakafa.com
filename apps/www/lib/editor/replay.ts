import type { ClientRecordView } from "@repo/backend/confect/editor/view";
import type { Node } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import type { Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { getVersion, sendableSteps } from "prosemirror-collab";
import {
  type Memory,
  markChanged,
  nowTime,
  StepRejected,
  type SyncSession,
} from "@/lib/editor/session";
import {
  addStep,
  readDocument,
  receiveOnto,
  settleSteps,
} from "@/lib/editor/settle";

/** The outcome of replacing an editor's state: the steps the replay refused, and the unconfirmed steps the rebase dropped. */
const Replacement = Schema.Struct({
  rebaseDropped: Schema.Natural,
  refused: Schema.Array(StepRejected),
});

/** How many steps the editor holds unconfirmed. */
const unconfirmedCount = (state: EditorState) =>
  sendableSteps(state)?.steps.length ?? 0;

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
 * snapshot, rebased over them. `confirmed` counts the leading unconfirmed steps that
 * are not replayed: the batch the server took, or a step that no call can carry. The
 * editor's state is read and replaced as one change, so an edit that lands while the
 * snapshot is read is among the steps replayed. When an edit lands before the
 * replacement, the replacement is built again on the state the editor holds now.
 */
const reseat = Effect.fn("editor.sync.reseat")(function* (
  session: SyncSession,
  snapshot: {
    readonly clientId: string;
    readonly confirmed: number;
    readonly doc: Node;
    readonly received: readonly Step[];
    readonly version: number;
  }
): Effect.fn.Return<typeof Replacement.Type, never> {
  const from = yield* session.port.state;
  const held = Arr.drop(sendableSteps(from)?.steps ?? [], snapshot.confirmed);
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

/** Logs each step of this editor that a replay refused, with the reason, as the editor drops it. */
const logRefused = (refused: readonly StepRejected[]) =>
  Effect.forEach(
    refused,
    (refusal) =>
      Effect.logWarning(
        `A step of this editor does not apply to the document it opened again from, so it is dropped: ${refusal.reason}`
      ),
    { discard: true }
  );

/**
 * Opens the document again from its snapshot, when the log no longer keeps the steps
 * this editor needs. The editor's batch is confirmed and dropped when the server says
 * it landed. The rest of the editor's unconfirmed steps are replayed on the snapshot,
 * and the server's steps after it rebase them. The steps that did not survive, and this
 * editor's own steps that the server skipped, are counted for the next report, and each
 * refused step is logged with its reason.
 */
export const reopen = Effect.fn("editor.sync.reopen")(function* (
  session: SyncSession
) {
  const memory = yield* Ref.get(session.memory);
  const opened = yield* session.transport.open(memory.clientId);
  const doc = yield* readDocument(session.port.schema, opened.snapshot.content);
  const settled = yield* settleSteps(session.port.schema, doc, opened.steps);
  const replaced = yield* reseat(session, {
    clientId: memory.clientId,
    confirmed: landedCount(memory, opened.client),
    doc,
    received: settled.received,
    version: opened.snapshot.version,
  });
  yield* logRefused(replaced.refused);
  // This editor's own steps that the server skipped are not in the document, and their
  // batch is dropped as landed, so they are lost and counted here.
  const ownSkipped = Arr.filter(
    settled.skipped,
    (view) => view.clientId === memory.clientId
  );
  const now = yield* nowTime;
  yield* Ref.set(session.server, settled.doc);
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.none(),
    dropped:
      current.dropped +
      replaced.refused.length +
      replaced.rebaseDropped +
      ownSkipped.length,
    head: opened.head,
    snapshotAt: Option.some(now),
    snapshotVersion: opened.snapshot.version,
  }));
  yield* markChanged(session, opened.steps);
});

/**
 * Drops the first unconfirmed step of this editor, which is larger than one call may send,
 * so no call can carry it (ADR 0028 Bounds). The editor is rebuilt on the server's document,
 * which is the document at its confirmed version, and its other unconfirmed steps are
 * replayed in order. A step that no longer applies is dropped too. The count goes into
 * the next report, and the batch is cleared, so the next round sends the steps that fit.
 */
export const dropUnsendable = Effect.fn("editor.sync.drop")(function* (
  session: SyncSession
) {
  const memory = yield* Ref.get(session.memory);
  const state = yield* session.port.state;
  const server = yield* Ref.get(session.server);
  yield* Effect.logWarning(
    "A step of this editor is larger than one call may send, so it is dropped."
  );
  const replaced = yield* reseat(session, {
    clientId: memory.clientId,
    confirmed: 1,
    doc: server,
    received: [],
    version: getVersion(state),
  });
  yield* logRefused(replaced.refused);
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.none(),
    dropped: current.dropped + 1 + replaced.refused.length,
  }));
});
