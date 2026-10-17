import type { StepView } from "@repo/backend/confect/editor/view";
import type { Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Ref } from "effect";
import { getVersion, receiveTransaction } from "prosemirror-collab";
import { reopen } from "@/lib/editor/replay";
import { SyncFailed, type SyncSession } from "@/lib/editor/session";
import { settleSteps } from "@/lib/editor/settle";

/** Whether the steps follow the version one by one, starting with the version after it. */
const followsVersion = (
  version: number,
  steps: readonly (typeof StepView.Type)[]
) => Arr.every(steps, (view, index) => view.version === version + index + 1);

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
 * steps confirm its unconfirmed ones, and the others are rebased over them. A reply
 * whose steps do not follow the editor's version is refused before any of it applies,
 * so no step is applied twice or skipped.
 */
const applySteps = Effect.fn("editor.sync.apply")(function* (
  session: SyncSession,
  steps: readonly (typeof StepView.Type)[]
) {
  const state = yield* session.port.state;
  if (!followsVersion(getVersion(state), steps)) {
    return yield* new SyncFailed({
      reason: "The server's steps do not follow this editor's version.",
    });
  }
  if (steps.length === 0) {
    return;
  }
  const server = yield* Ref.get(session.server);
  const settled = yield* settleSteps(session.port.schema, server, steps);
  const memory = yield* Ref.get(session.memory);
  if (Arr.some(settled.skipped, (view) => view.clientId === memory.clientId)) {
    // The server skipped a step of this editor, so the document the editors share does
    // not hold its effect, but this editor's state still does, and the collab plugin
    // would confirm the step without applying it again. The editor opens again from
    // the snapshot instead, where its landed batch is dropped and the loss is counted.
    return yield* reopen(session);
  }
  yield* dispatchReceived(
    session,
    settled.received,
    Arr.map(steps, (view) => view.clientId)
  );
  yield* Ref.set(session.server, settled.doc);
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
  yield* applySteps(session, reply.steps);
});
