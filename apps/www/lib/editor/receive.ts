import { decodeStep } from "@repo/backend/confect/editor/step";
import type { StepView } from "@repo/backend/confect/editor/view";
import { JsonTextSchema } from "@repo/utilities/json";
import type { Schema as ProseSchema } from "@tiptap/pm/model";
import { Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import {
  getVersion,
  receiveTransaction,
  sendableSteps,
} from "prosemirror-collab";
import {
  nowTime,
  SyncDiverged,
  SyncFailed,
  type SyncSession,
} from "@/lib/editor/session";

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
 * Applies the steps the server returned, in order, through the collab plugin: the
 * editor's own steps confirm its unconfirmed ones, and the others are rebased over
 * them. The head moves to the server's head, and an edit by another editor counts
 * as a change for the idle rule. A reply whose steps do not follow the editor's
 * version is refused before any of it applies, so no step is applied twice or
 * skipped.
 */
export const applySteps = Effect.fn("editor.sync.apply")(function* (
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
  const memory = yield* Ref.get(session.memory);
  const parsed = yield* Effect.forEach(steps, (view) =>
    readStep(session.port.schema, view.step)
  );
  const transaction = yield* Effect.try({
    try: () =>
      receiveTransaction(
        state,
        parsed,
        Arr.map(steps, (view) => view.clientId)
      ),
    catch: () =>
      new SyncFailed({ reason: "The server's steps did not apply." }),
  });
  yield* session.port.dispatch(transaction);
  if (Arr.some(steps, (view) => view.clientId !== memory.clientId)) {
    const now = yield* nowTime;
    yield* Ref.update(session.memory, (current) => ({
      ...current,
      lastChangeAt: now,
    }));
  }
});

/** Opens the document again from its snapshot, then applies the steps after the snapshot. */
const reopen = Effect.fn("editor.sync.reopen")(function* (
  session: SyncSession
) {
  const state = yield* session.port.state;
  if (sendableSteps(state) !== null) {
    return yield* new SyncDiverged();
  }
  const opened = yield* session.transport.open;
  const memory = yield* Ref.get(session.memory);
  const doc = yield* readDocument(session.port.schema, opened.snapshot.content);
  yield* session.port.replace({
    clientId: memory.clientId,
    doc,
    version: opened.snapshot.version,
  });
  const now = yield* nowTime;
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    blockedAt: Option.none(),
    snapshotAt: Option.some(now),
    snapshotVersion: opened.snapshot.version,
  }));
  return yield* applySteps(session, opened.steps, opened.head);
});

/**
 * Takes the server's steps after this editor's version. A `behind` reply means the
 * log no longer keeps the first step this editor needs, so the document is opened
 * again from its snapshot. That is refused while this editor holds unconfirmed steps.
 */
export const pull = Effect.fn("editor.sync.pull")(function* (
  session: SyncSession
) {
  const state = yield* session.port.state;
  const reply = yield* session.transport.since(getVersion(state));
  if (reply._tag === "behind") {
    return yield* reopen(session);
  }
  return yield* applySteps(session, reply.steps, reply.head);
});
