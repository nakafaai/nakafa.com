import {
  type Batch,
  decodeBatch,
  VersionStale,
} from "@repo/backend/confect/editor/batch";
import { SnapshotRefused } from "@repo/backend/confect/editor/errors";
import { SNAPSHOT_IDLE_DELAY } from "@repo/backend/confect/editor/snapshot";
import { encodeStep } from "@repo/backend/confect/editor/step";
import type { SinceReply } from "@repo/backend/confect/editor/view";
import { encodeJsonText } from "@repo/utilities/json";
import { type Node, Schema as ProseSchema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { Array as Arr, Duration, Effect, Ref, Schema } from "effect";
import { collab } from "prosemirror-collab";
import type {
  EditorPort,
  SyncSession,
  SyncTransport,
} from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";

/** The schema of the tests: paragraphs of text, which a text step lands in, and quotes that nest them. */
const proseSchema = new ProseSchema({
  nodes: {
    doc: { content: "(paragraph | quote)+" },
    paragraph: { content: "text*", group: "block" },
    quote: { content: "(paragraph | quote)+", group: "block" },
    text: { group: "inline", inline: true },
  },
});

/** A paragraph inside `levels - 1` quotes, so the top node is `levels` levels deep. */
export const nestedQuote = (levels: number): Node => {
  let node = proseSchema.node("paragraph", null, [proseSchema.text("x")]);
  for (let level = 1; level < levels; level += 1) {
    node = proseSchema.node("quote", null, [node]);
  }
  return node;
};

/** Past the snapshot rule's idle delay by one second, so a snapshot is due at once. */
export const IDLE = Duration.sum(SNAPSHOT_IDLE_DELAY, Duration.seconds(1));

/** One empty document, where every test starts. */
const emptyDoc = () =>
  proseSchema.node("doc", null, [proseSchema.node("paragraph")]);

/** The fake server's state: its head, its steps, its snapshot, and what it counted. */
const FakeLog = Schema.Struct({
  firstKept: Schema.Finite,
  head: Schema.Finite,
  saveAttempts: Schema.Finite,
  saves: Schema.Finite,
  snapshot: Schema.Struct({ content: Schema.String, version: Schema.Finite }),
  steps: Schema.Array(
    Schema.Struct({
      clientId: Schema.String,
      step: Schema.String,
      version: Schema.Finite,
    })
  ),
  submitAttempts: Schema.Finite,
  submits: Schema.Finite,
});

/**
 * A fake of the Convex functions that the loop calls. It applies the version rule
 * of the server, and it stores each step as the server does: as JSON text, with
 * the client that sent it.
 */
export const makeServer = Effect.fn("test.sync.server")(function* (
  initialContent = encodeJsonText(emptyDoc().toJSON())
) {
  const log = yield* Ref.make<typeof FakeLog.Type>({
    firstKept: 1,
    head: 0,
    saveAttempts: 0,
    saves: 0,
    snapshot: { content: initialContent, version: 0 },
    steps: [],
    submitAttempts: 0,
    submits: 0,
  });
  const refuseSaves = yield* Ref.make(false);

  const transport: SyncTransport = {
    open: Effect.map(Ref.get(log), (current) => ({
      head: current.head,
      snapshot: current.snapshot,
      steps: Arr.filter(
        current.steps,
        (step) => step.version > current.snapshot.version
      ),
    })),
    since: (version) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(log);
        if (current.head > version && current.firstKept > version + 1) {
          return {
            _tag: "behind",
            head: current.head,
          } satisfies typeof SinceReply.Type;
        }
        return {
          _tag: "steps",
          head: current.head,
          steps: Arr.filter(current.steps, (step) => step.version > version),
        } satisfies typeof SinceReply.Type;
      }),
    submit: (text) =>
      Effect.gen(function* () {
        yield* Ref.update(log, (state) => ({
          ...state,
          submitAttempts: state.submitAttempts + 1,
        }));
        const batch: Batch = yield* decodeBatch(text).pipe(Effect.orDie);
        const current = yield* Ref.get(log);
        if (batch.baseVersion !== current.head) {
          return yield* new VersionStale({
            baseVersion: batch.baseVersion,
            head: current.head,
          });
        }
        const stored = yield* Effect.forEach(batch.steps, (step) =>
          encodeStep(step).pipe(Effect.orDie)
        );
        const head = current.head + batch.steps.length;
        yield* Ref.update(log, (state) => ({
          ...state,
          head,
          steps: [
            ...state.steps,
            ...Arr.map(stored, (step, index) => ({
              clientId: batch.clientId,
              step,
              version: current.head + index + 1,
            })),
          ],
          submits: state.submits + 1,
        }));
        return { head };
      }),
    save: ({ content, version }) =>
      Effect.gen(function* () {
        yield* Ref.update(log, (state) => ({
          ...state,
          saveAttempts: state.saveAttempts + 1,
        }));
        if (yield* Ref.get(refuseSaves)) {
          return yield* new SnapshotRefused({ reason: "notDue" });
        }
        yield* Ref.update(log, (state) => ({
          ...state,
          saves: state.saves + 1,
          snapshot: { content, version },
        }));
        return { version };
      }),
  };

  return {
    counts: Effect.map(Ref.get(log), (current) => ({
      head: current.head,
      saveAttempts: current.saveAttempts,
      saves: current.saves,
      snapshotVersion: current.snapshot.version,
      submitAttempts: current.submitAttempts,
      submits: current.submits,
    })),
    /** Drops the steps that a snapshot at `through` covers, as the server's sweep does once they are old. */
    prune: (through: number) =>
      Ref.update(log, (state) => ({
        ...state,
        firstKept: through + 1,
        steps: Arr.filter(state.steps, (step) => step.version > through),
      })),
    refuseSaves: (refuse: boolean) => Ref.set(refuseSaves, refuse),
    transport,
  };
});

/** One editor's port over the state it holds, as a Tiptap editor's view would hold it. */
const makePort = Effect.fn("test.sync.port")(function* () {
  const state = yield* Ref.make(EditorState.create({ doc: emptyDoc() }));
  const port: EditorPort = {
    schema: proseSchema,
    state: Ref.get(state),
    dispatch: (transaction) =>
      Ref.update(state, (current) => current.apply(transaction)),
    replace: ({ clientId, doc, version }) =>
      Ref.set(
        state,
        EditorState.create({
          doc,
          plugins: [collab({ clientID: clientId, version })],
        })
      ),
  };
  return { port, state };
});

/** Types text at the start of the document, as one local edit of an editor. */
export const typeText = Effect.fn("test.sync.typeText")(function* (
  state: Ref.Ref<EditorState>,
  text: string
) {
  yield* Ref.update(state, (current) =>
    current.apply(current.tr.insertText(text, 1))
  );
});

/** The text of a document, which the convergence checks compare. */
export const textOf = (doc: Node) => doc.textContent;

/** Starts one editor on the server's document. */
export const openEditor = Effect.fn("test.sync.open")(function* (
  transport: SyncTransport
) {
  const { port, state } = yield* makePort();
  const session: SyncSession = yield* startSync(port, transport);
  return { session, state };
});

/** Runs `rounds` of ticks over every editor, so each one sees what the others sent. */
export const settle = Effect.fn("test.sync.settle")(function* (
  sessions: readonly SyncSession[],
  rounds: number
) {
  yield* Effect.forEach(
    Arr.makeBy(rounds, (round) => round),
    () =>
      Effect.forEach(sessions, (session) => tick(session), { discard: true }),
    { discard: true }
  );
});

/**
 * The session of an editor whose subscription has not delivered the server's
 * steps: its reads report the server's head, with no steps.
 */
export const silentEditor = (
  server: Effect.Success<ReturnType<typeof makeServer>>,
  session: SyncSession
): SyncSession => ({
  ...session,
  transport: {
    ...server.transport,
    since: () =>
      Effect.map(
        server.counts,
        ({ head }) =>
          ({
            _tag: "steps",
            head,
            steps: [],
          }) satisfies typeof SinceReply.Type
      ),
  },
});
