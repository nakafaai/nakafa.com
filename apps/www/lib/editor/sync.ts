import {
  BatchSchema,
  encodeBatch,
  type VersionStale,
} from "@repo/backend/confect/editor/batch";
import type { SnapshotRefused } from "@repo/backend/confect/editor/errors";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import { snapshotDue } from "@repo/backend/confect/editor/snapshot";
import { decodeStep } from "@repo/backend/confect/editor/step";
import type {
  OpenedDocument,
  SinceReply,
  StepView,
} from "@repo/backend/confect/editor/view";
import { randomUuid } from "@repo/utilities/uuid";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Step } from "@tiptap/pm/transform";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Option,
  Ref,
  Schema,
} from "effect";
import {
  getVersion,
  receiveTransaction,
  sendableSteps,
} from "prosemirror-collab";

/** A call to the server that failed for a reason the loop does not decide: the network, a denied access, or a refused read. */
export class SyncFailed extends Schema.TaggedError<SyncFailed>()("SyncFailed", {
  reason: Schema.String,
}) {}

/**
 * The server's log no longer keeps the steps this editor is missing, and this
 * editor holds steps the server has not accepted. Opening the document again
 * would drop those steps, so the loop stops and the editor keeps them.
 */
export class SyncDiverged extends Schema.TaggedError<SyncDiverged>()(
  "SyncDiverged",
  {}
) {}

/** The server calls the loop makes. Each one wraps a Convex function, and maps the failures the loop does not decide to `SyncFailed`. */
export interface SyncTransport {
  readonly open: Effect.Effect<typeof OpenedDocument.Type, SyncFailed>;
  readonly save: (snapshot: {
    readonly content: string;
    readonly version: number;
  }) => Effect.Effect<
    { readonly version: number },
    SyncFailed | SnapshotRefused
  >;
  readonly since: (
    version: number
  ) => Effect.Effect<typeof SinceReply.Type, SyncFailed>;
  readonly submit: (
    batch: string
  ) => Effect.Effect<{ readonly head: number }, SyncFailed | VersionStale>;
}

/** The editor the loop reads and changes. The caller builds it over a Tiptap editor, or over a plain state in a test. */
export interface EditorPort {
  readonly dispatch: (transaction: Transaction) => Effect.Effect<void>;
  /** Replaces the document with a fresh state at this version, under this client ID. */
  readonly replace: (input: {
    readonly clientId: string;
    readonly doc: Node;
    readonly version: number;
  }) => Effect.Effect<void>;
  readonly schema: ProseSchema;
  readonly state: Effect.Effect<EditorState>;
}

/**
 * What the loop remembers between ticks. `blockedAt` is the version of the batch
 * last sent, while that batch is in flight or refused: the next batch waits until
 * the server's steps move the version on. `lastChangeAt` is the last time an edit
 * of this document was seen, from this editor or another, and the snapshot rule
 * reads it as the idle time.
 */
const Memory = Schema.Struct({
  blockedAt: Schema.Option(Schema.Natural),
  clientId: Schema.String,
  head: Schema.Natural,
  lastChangeAt: Schema.DateTimeUtc,
  snapshotAt: Schema.Option(Schema.DateTimeUtc),
  snapshotVersion: Schema.Natural,
});

/** One editor's sync with one document: its port, its transport, and what it remembers. */
export interface SyncSession {
  readonly memory: Ref.Ref<typeof Memory.Type>;
  readonly port: EditorPort;
  readonly transport: SyncTransport;
}

/** A JSON value as text, which the snapshot and the document use as their wire form. */
const JsonText = Schema.fromJsonString(Schema.Unknown);

/** The current time as a `DateTime`, read from the clock so a test can move it. */
const nowTime = Effect.map(Clock.currentTimeMillis, DateTime.makeUnsafe);

/** Reads a document from its JSON text into a ProseMirror node of the schema. */
const readDocument = Effect.fn("editor.sync.document")(function* (
  schema: ProseSchema,
  content: string
) {
  const json = yield* Schema.decodeEffect(JsonText)(content).pipe(Effect.orDie);
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

/**
 * Applies the steps the server returned, in order, through the collab plugin: the
 * editor's own steps confirm its unconfirmed ones, and the others are rebased over
 * them. The head moves to the server's head, and an edit by another editor counts
 * as a change for the idle rule.
 */
const applySteps = Effect.fn("editor.sync.apply")(function* (
  session: SyncSession,
  steps: readonly (typeof StepView.Type)[],
  head: number
) {
  yield* Ref.update(session.memory, (current) => ({ ...current, head }));
  if (steps.length === 0) {
    return;
  }
  const memory = yield* Ref.get(session.memory);
  const parsed = yield* Effect.forEach(steps, (view) =>
    readStep(session.port.schema, view.step)
  );
  const state = yield* session.port.state;
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

/**
 * Encodes the longest prefix of the steps that one call may send: at most
 * `MAX_BATCH_STEPS`, and under the byte bound. A prefix that is too large halves,
 * until it fits. One step too large for one call is a failure, because no prefix
 * of it can be sent.
 */
const fittingBatch = Effect.fn("editor.sync.batch")(function* (
  baseVersion: number,
  clientId: string,
  steps: readonly Step[],
  count: number
): Effect.fn.Return<string, SyncFailed> {
  const batch = yield* Schema.decodeUnknownEffect(BatchSchema)({
    baseVersion,
    clientId,
    steps: Arr.map(Arr.take(steps, count), (step) => step.toJSON()),
  }).pipe(Effect.orDie);
  return yield* encodeBatch(batch).pipe(
    Effect.catchTags({
      // The batch was decoded just above, so the encoder cannot refuse its shape.
      SchemaError: Effect.die,
      BatchTooLarge: (tooLarge) =>
        count > 1
          ? fittingBatch(baseVersion, clientId, steps, Math.floor(count / 2))
          : Effect.fail(
              new SyncFailed({
                reason: `One step takes ${tooLarge.bytes} bytes, more than one call may send.`,
              })
            ),
    })
  );
});

/** Sends the editor's unconfirmed steps on the version they were made on, unless a batch on that version is in flight or refused. */
const push = Effect.fn("editor.sync.push")(function* (session: SyncSession) {
  const state = yield* session.port.state;
  const sendable = sendableSteps(state);
  if (sendable === null) {
    return;
  }
  const memory = yield* Ref.get(session.memory);
  if (Option.exists(memory.blockedAt, (at) => at === sendable.version)) {
    return;
  }
  const now = yield* nowTime;
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    blockedAt: Option.some(sendable.version),
    lastChangeAt: now,
  }));
  const batch = yield* fittingBatch(
    sendable.version,
    String(sendable.clientID),
    sendable.steps,
    Math.min(sendable.steps.length, MAX_BATCH_STEPS)
  ).pipe(
    Effect.tapError(() =>
      Ref.update(session.memory, (current) => ({
        ...current,
        blockedAt: Option.none(),
      }))
    )
  );
  yield* session.transport.submit(batch).pipe(
    // An accepted batch tells the editor the server's head now, before its own steps
    // come back through the subscription.
    Effect.tap(({ head }) =>
      Ref.update(session.memory, (current) => ({ ...current, head }))
    ),
    Effect.catchTags({
      VersionStale: () => Effect.void,
      // The batch may not have reached the server, and the version has not moved,
      // so the next tick may send it again. The server refuses a repeat after success.
      SyncFailed: (failure) =>
        Ref.update(session.memory, (current) => ({
          ...current,
          blockedAt: Option.none(),
        })).pipe(Effect.andThen(Effect.fail(failure))),
    })
  );
});

/**
 * Takes the server's steps after this editor's version. A `behind` reply means the
 * log no longer keeps the first step this editor needs, so the document is opened
 * again from its snapshot. That is refused while this editor holds unconfirmed steps.
 */
const pull = Effect.fn("editor.sync.pull")(function* (session: SyncSession) {
  const state = yield* session.port.state;
  const reply = yield* session.transport.since(getVersion(state));
  if (reply._tag === "behind") {
    return yield* reopen(session);
  }
  return yield* applySteps(session, reply.steps, reply.head);
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
 * Saves the document at the editor's version when nothing is unconfirmed and the
 * snapshot rule of ADR 0028 allows one now. A refusal from the server is not an
 * error: the next save waits for the rule again, so a refused save is not retried
 * on every tick.
 */
const snapshotIfDue = Effect.fn("editor.sync.snapshot")(function* (
  session: SyncSession
) {
  const state = yield* session.port.state;
  if (sendableSteps(state) !== null) {
    return;
  }
  const memory = yield* Ref.get(session.memory);
  const now = yield* nowTime;
  const due = snapshotDue({
    lastSnapshotAt: memory.snapshotAt,
    lastStepAt: memory.lastChangeAt,
    now,
    stepsSince: memory.head - memory.snapshotVersion,
  });
  if (!due) {
    return;
  }
  const version = getVersion(state);
  const content = yield* Schema.encodeEffect(JsonText)(state.doc.toJSON()).pipe(
    Effect.orDie
  );
  const saved = yield* session.transport.save({ content, version }).pipe(
    Effect.as(true),
    Effect.catchTag("SnapshotRefused", () => Effect.succeed(false))
  );
  yield* Ref.update(session.memory, (current) =>
    saved
      ? { ...current, snapshotAt: Option.some(now), snapshotVersion: version }
      : { ...current, snapshotAt: Option.some(now) }
  );
});

/**
 * Opens the document for an editor. The editor gets a client ID of its own, the
 * snapshot becomes its starting state, and the steps after the snapshot follow.
 */
export const startSync = Effect.fn("editor.sync.start")(function* (
  port: EditorPort,
  transport: SyncTransport
) {
  const clientId = yield* randomUuid;
  const opened = yield* transport.open;
  const doc = yield* readDocument(port.schema, opened.snapshot.content);
  yield* port.replace({ clientId, doc, version: opened.snapshot.version });
  const now = yield* nowTime;
  const memory = yield* Ref.make<typeof Memory.Type>({
    blockedAt: Option.none(),
    clientId,
    head: opened.snapshot.version,
    lastChangeAt: now,
    snapshotAt: Option.none(),
    snapshotVersion: opened.snapshot.version,
  });
  const session: SyncSession = { memory, port, transport };
  yield* applySteps(session, opened.steps, opened.head);
  return session;
});

/**
 * One round of sync: take the server's steps, send the editor's own steps, and save
 * a snapshot when the rule allows one. It never loops. After a refused batch, the
 * caller runs the next round when the server's steps arrive, as the subscription
 * to the document does.
 */
export const tick = Effect.fn("editor.sync.tick")(function* (
  session: SyncSession
) {
  yield* pull(session);
  yield* push(session);
  yield* snapshotIfDue(session);
});
