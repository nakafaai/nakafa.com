import {
  type Batch,
  decodeBatch,
  VersionStale,
} from "@repo/backend/confect/editor/batch";
import { foldSteps, snapshotNode } from "@repo/backend/confect/editor/fold";
import { decodeStep, encodeStep } from "@repo/backend/confect/editor/step";
import type { SinceReply } from "@repo/backend/confect/editor/view";
import { encodeJsonText } from "@repo/utilities/json";
import { type Node, Schema as ProseSchema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { collab } from "prosemirror-collab";
import type {
  EditorPort,
  SyncSession,
  SyncTransport,
} from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";

/**
 * The schema of the tests: paragraphs of text, which a text step lands in, and
 * blockquotes that nest them. The node types are the ones the editor reads (the
 * server refuses any other), so a test step is one the server stores.
 */
const proseSchema = new ProseSchema({
  nodes: {
    doc: { content: "(paragraph | blockquote)+" },
    paragraph: { content: "text*", group: "block" },
    blockquote: { content: "(paragraph | blockquote)+", group: "block" },
    text: { group: "inline", inline: true },
  },
});

/** A paragraph inside `levels - 1` blockquotes, so the top node is `levels` levels deep. */
export const nestedQuote = (levels: number): Node => {
  let node = proseSchema.node("paragraph", null, [proseSchema.text("x")]);
  for (let level = 1; level < levels; level += 1) {
    node = proseSchema.node("blockquote", null, [node]);
  }
  return node;
};

/** One empty document, where every test starts. */
const emptyDoc = () =>
  proseSchema.node("doc", null, [proseSchema.node("paragraph")]);

/** The JSON text of the empty document, which a server starts from. */
const EMPTY_DOCUMENT = encodeJsonText(emptyDoc().toJSON());

/** One editor session's record on the fake server: the batch it had accepted last, and the version that batch produced. */
const FakeClient = Schema.Struct({
  batch: Schema.String,
  clientId: Schema.String,
  version: Schema.Finite,
});

/** The fake server's state: its head, its steps, its snapshot, its sessions, and what it counted. */
const FakeLog = Schema.Struct({
  clients: Schema.Array(FakeClient),
  firstKept: Schema.Finite,
  head: Schema.Finite,
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

/** The record of a session, read as the wire shows it: null before the session's first accepted batch. */
const clientOf = (current: typeof FakeLog.Type, clientId: string) =>
  Option.match(
    Arr.findFirst(current.clients, (client) => client.clientId === clientId),
    {
      onNone: () => null,
      onSome: ({ batch, version }) => ({ batch, version }),
    }
  );

/**
 * A fake of the Convex functions that the loop calls. It applies the version rule
 * of the server, keeps one record per session as the server does, answers a repeat
 * of an accepted batch with its version, and stores each step as JSON text, with the
 * client that sent it. It does not apply the steps, so a test can store a step that
 * does not apply and see every editor skip it.
 */
export const makeServer = Effect.fn("test.sync.server")(function* (
  initialContent = EMPTY_DOCUMENT
) {
  const log = yield* Ref.make<typeof FakeLog.Type>({
    clients: [],
    firstKept: 1,
    head: 0,
    snapshot: { content: initialContent, version: 0 },
    steps: [],
    submitAttempts: 0,
    submits: 0,
  });

  const transport: SyncTransport = {
    open: (clientId) =>
      Effect.map(Ref.get(log), (current) => ({
        client: clientOf(current, clientId),
        head: current.head,
        snapshot: current.snapshot,
        steps: Arr.filter(
          current.steps,
          (step) => step.version > current.snapshot.version
        ),
      })),
    since: (clientId, version) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(log);
        const client = clientOf(current, clientId);
        if (current.head > version && current.firstKept > version + 1) {
          return {
            _tag: "behind",
            client,
            head: current.head,
          } satisfies typeof SinceReply.Type;
        }
        return {
          _tag: "steps",
          client,
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
        const record = clientOf(current, batch.clientId);
        if (record !== null && record.batch === batch.batch) {
          return { head: record.version };
        }
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
          clients: [
            ...Arr.filter(
              state.clients,
              (client) => client.clientId !== batch.clientId
            ),
            { batch: batch.batch, clientId: batch.clientId, version: head },
          ],
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
  };

  return {
    counts: Effect.map(Ref.get(log), (current) => ({
      head: current.head,
      snapshotVersion: current.snapshot.version,
      submitAttempts: current.submitAttempts,
      submits: current.submits,
    })),
    /**
     * Folds the steps after the snapshot into it, as the server folds its log. The fold
     * is the one of `confect/editor/fold`, so the server's snapshot is the document the
     * editors share, and no editor writes it (ADR 0028).
     */
    fold: Effect.gen(function* () {
      const current = yield* Ref.get(log);
      const pending = Arr.filter(
        current.steps,
        (step) => step.version > current.snapshot.version
      );
      const start = yield* snapshotNode(proseSchema, current.snapshot.content);
      const steps = yield* Effect.forEach(pending, (step) =>
        decodeStep(step.step).pipe(Effect.orDie)
      );
      const folded = yield* foldSteps(
        proseSchema,
        start,
        current.snapshot.version,
        steps
      );
      yield* Ref.update(log, (state) => ({
        ...state,
        snapshot: {
          content: encodeJsonText(folded.doc.toJSON()),
          version: Arr.reduce(
            pending,
            current.snapshot.version,
            (_, step) => step.version
          ),
        },
      }));
    }),
    snapshot: Effect.map(Ref.get(log), (current) => current.snapshot),
    /** Drops the steps that a snapshot at `through` covers, as the server's sweep does once they are old. */
    prune: (through: number) =>
      Ref.update(log, (state) => ({
        ...state,
        firstKept: through + 1,
        steps: Arr.filter(state.steps, (step) => step.version > through),
      })),
    transport,
  };
});

/**
 * One editor's port over the state it holds, as a Tiptap editor's view would hold it.
 * A change applies only while the editor still holds the state it was built from, as
 * the view's own dispatch does, so a test can move the editor between two steps.
 */
export const makePort = Effect.fn("test.sync.port")(function* (
  schema: ProseSchema = proseSchema,
  doc: Node = emptyDoc()
) {
  const state = yield* Ref.make(EditorState.create({ doc }));
  const port: EditorPort = {
    dispatch: (from, transaction) =>
      Ref.modify(state, (current) =>
        current === from ? [true, current.apply(transaction)] : [false, current]
      ),
    fresh: ({ clientId, doc, version }) =>
      EditorState.create({
        doc,
        plugins: [collab({ clientID: clientId, version })],
      }),
    replace: (from, next) =>
      Ref.modify(state, (current) =>
        current === from ? [true, next] : [false, current]
      ),
    schema,
    state: Ref.get(state),
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

/** The text of three letters typed by three editors, in any order. */
export const THREE_LETTERS = /^[abc]{3}$/;

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
            client: null,
            head,
            steps: [],
          }) satisfies typeof SinceReply.Type
      ),
  },
});
