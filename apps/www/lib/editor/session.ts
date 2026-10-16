import type { VersionStale } from "@repo/backend/confect/editor/batch";
import type { SnapshotRefused } from "@repo/backend/confect/editor/errors";
import type {
  OpenedDocument,
  SinceReply,
} from "@repo/backend/confect/editor/view";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  Clock,
  DateTime,
  Effect,
  type Ref,
  Schema,
  type Semaphore,
} from "effect";

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
 * What the loop remembers between rounds. `blockedAt` is the version of the batch
 * last sent, while that batch is in flight or refused: the next batch waits until
 * the server's steps move the version on. `lastChangeAt` is the last time an edit
 * of this document was seen, from this editor or another, and the snapshot rule
 * reads it as the idle time.
 */
export const Memory = Schema.Struct({
  blockedAt: Schema.Option(Schema.Natural),
  clientId: Schema.String,
  head: Schema.Natural,
  lastChangeAt: Schema.DateTimeUtc,
  snapshotAt: Schema.Option(Schema.DateTimeUtc),
  snapshotVersion: Schema.Natural,
});

/**
 * One editor's sync with one document: its port, its transport, what it remembers,
 * and its rounds. A round reads the version, waits for the server, and then applies
 * the reply, so two rounds at once would apply one reply twice. The `rounds` lock
 * lets one round run at a time.
 */
export interface SyncSession {
  readonly memory: Ref.Ref<typeof Memory.Type>;
  readonly port: EditorPort;
  readonly rounds: Semaphore.Semaphore;
  readonly transport: SyncTransport;
}

/** The current time as a `DateTime`, read from the clock so a test can move it. */
export const nowTime = Effect.map(Clock.currentTimeMillis, DateTime.makeUnsafe);
