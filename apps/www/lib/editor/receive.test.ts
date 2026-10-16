import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { nodeDepth } from "@repo/design-system/components/editor/depth";
import { encodeJsonText } from "@repo/utilities/json";
import type { Node } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";
import { getVersion, sendableSteps } from "prosemirror-collab";
import type { SyncSession } from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";
import {
  EMPTY_DOCUMENT,
  IDLE,
  makePort,
  makeServer,
  nestedQuote,
  openEditor,
  settle,
  silentEditor,
  textOf,
  typeText,
} from "@/test/sync";

/** The text of three letters typed by three editors, in any order. */
const THREE_LETTERS = /^[abc]{3}$/;

describe("editor/sync stored steps that do not apply", () => {
  it.effect(
    "converges three editors on one document when the log holds a step that does not apply, and every editor skips it",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        // The server stores this step without applying it: it moves past the end of the document.
        const bad = yield* encodeBatch({
          baseVersion: 0,
          batch: "rina-bad",
          clientId: "rina",
          steps: [
            {
              from: 99,
              slice: { content: [{ text: "x", type: "text" }] },
              stepType: "replace",
              to: 99,
            },
          ],
        }).pipe(Effect.orDie);
        yield* server.transport.submit(bad).pipe(Effect.orDie);
        const first = yield* openEditor(server.transport);
        const second = yield* openEditor(server.transport);
        const third = yield* openEditor(server.transport);
        yield* typeText(first.state, "a");
        yield* typeText(second.state, "b");
        yield* typeText(third.state, "c");
        yield* settle([first.session, second.session, third.session], 4);
        const firstState = yield* Ref.get(first.state);
        const secondState = yield* Ref.get(second.state);
        const thirdState = yield* Ref.get(third.state);
        expect(secondState.doc.toJSON()).toEqual(firstState.doc.toJSON());
        expect(thirdState.doc.toJSON()).toEqual(firstState.doc.toJSON());
        expect(textOf(firstState.doc)).toMatch(THREE_LETTERS);
        // The skipped step still counts in the version, so the editors stand at the head.
        expect(getVersion(firstState)).toBe(4);
        expect(getVersion(thirdState)).toBe(4);
        // A snapshot saved after the skip holds the document the editors share.
        yield* TestClock.adjust(IDLE);
        yield* tick(first.session);
        const snapshot = yield* server.snapshot;
        expect(snapshot).toEqual({
          content: encodeJsonText(firstState.doc.toJSON()),
          version: 4,
        });
      })
  );

  it.effect(
    "refuses a reply that skips a version, and applies none of its steps",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const reader = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* typeText(writer.state, "b");
        yield* tick(writer.session);
        // This reply drops version 1, so it holds only version 2, which does not follow
        // the reader's version 0.
        const skipping: SyncSession = {
          ...reader.session,
          transport: {
            ...server.transport,
            since: (clientId, version) =>
              server.transport.since(clientId, version).pipe(
                Effect.map((reply) =>
                  reply._tag === "steps"
                    ? {
                        ...reply,
                        steps: Arr.filter(
                          reply.steps,
                          (step) => step.version !== 1
                        ),
                      }
                    : reply
                )
              ),
          },
        };
        const failure = yield* tick(skipping).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SyncFailed" });
        const readerState = yield* Ref.get(reader.state);
        expect(textOf(readerState.doc)).toBe("");
        expect(getVersion(readerState)).toBe(0);
      })
  );
});

/** A document nested to the bound less one: a paragraph in twelve blockquotes, held by the `doc` node. */
const DEEP_DOCUMENT = encodeJsonText({
  content: [nestedQuote(13).toJSON()],
  type: "doc",
});

/** The start and the end of the paragraph that holds the text, which each test document holds once. */
const Bounds = Schema.Struct({ from: Schema.Natural, to: Schema.Natural });

function paragraphBounds(doc: Node): typeof Bounds.Type | null {
  let found: typeof Bounds.Type | null = null;
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") {
      found = { from: pos, to: pos + node.nodeSize };
    }
    return true;
  });
  return found;
}

/** Wraps every block of the document in one blockquote, as one local edit of an editor does. */
const wrapDocument = (state: EditorState) => {
  const { doc, schema, tr } = state;
  const range = doc.resolve(0).blockRange(doc.resolve(doc.content.size));
  return range === null
    ? state
    : state.apply(tr.wrap(range, [{ type: schema.nodes.blockquote }]));
};

/** Wraps the paragraph that holds the text in one blockquote, as one local edit of an editor does. */
const wrapParagraph = (state: EditorState) => {
  const { doc, schema, tr } = state;
  const bounds = paragraphBounds(doc);
  const range =
    bounds === null
      ? null
      : doc.resolve(bounds.from).blockRange(doc.resolve(bounds.to));
  return range === null
    ? state
    : state.apply(tr.wrap(range, [{ type: schema.nodes.blockquote }]));
};

describe("editor/sync document bounds", () => {
  it.effect(
    "converges three editors on one document within the bound when a rebased step nests it past the bound, and the editor that made that step opens again",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer(DEEP_DOCUMENT);
        const writer = yield* openEditor(server.transport);
        const rebased = yield* openEditor(server.transport);
        const observer = yield* openEditor(server.transport);
        // The writer nests the document to the bound, and the second editor nests the
        // paragraph one level deeper on the version before the writer's step: once the
        // writer's step lands, the second editor's step, rebased, is past the bound.
        yield* Ref.update(writer.state, wrapDocument);
        yield* Ref.update(rebased.state, wrapParagraph);
        yield* tick(writer.session);
        yield* tick(rebased.session);
        yield* tick(observer.session);
        yield* tick(writer.session);
        // The second editor sees its own step skipped, and opens again from the snapshot.
        const dropped = yield* tick(rebased.session);
        const writerState = yield* Ref.get(writer.state);
        const rebasedState = yield* Ref.get(rebased.state);
        const observerState = yield* Ref.get(observer.state);
        expect(rebasedState.doc.toJSON()).toEqual(writerState.doc.toJSON());
        expect(observerState.doc.toJSON()).toEqual(writerState.doc.toJSON());
        // The writer's step alone takes the document to the bound, and the rebased step is skipped.
        expect(nodeDepth(writerState.doc)).toBe(MAX_DOCUMENT_DEPTH);
        expect(getVersion(writerState)).toBe(2);
        expect(getVersion(rebasedState)).toBe(2);
        expect(getVersion(observerState)).toBe(2);
        expect(Option.getOrNull(dropped)).toMatchObject({
          _tag: "SyncDropped",
          count: 1,
        });
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
      })
  );
});

describe("editor/sync reopening from a snapshot", () => {
  it.effect(
    "opens the document again from its snapshot after the log pruned the steps an editor needs",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const reader = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* TestClock.adjust(IDLE);
        yield* tick(writer.session);
        expect(yield* server.counts).toMatchObject({
          head: 1,
          snapshotVersion: 1,
        });
        yield* typeText(writer.state, "b");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.prune(1);
        yield* tick(reader.session);
        const readerState = yield* Ref.get(reader.state);
        const writerState = yield* Ref.get(writer.state);
        expect(getVersion(readerState)).toBe(2);
        expect(textOf(readerState.doc)).toBe(textOf(writerState.doc));
      })
  );

  it.effect(
    "replays the steps an editor holds onto the snapshot when it opens again, and sends them",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const stale = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* TestClock.adjust(IDLE);
        yield* tick(writer.session);
        yield* typeText(stale.state, "unsent");
        // The stale editor sends its batch before it sees the server's steps, so the server
        // refuses it, and it waits. The log then loses the steps it needs.
        yield* tick(silentEditor(server, stale.session));
        yield* server.prune(1);
        const dropped = yield* tick(stale.session);
        expect(Option.isNone(dropped)).toBe(true);
        expect(textOf((yield* Ref.get(stale.state)).doc)).toBe("unsenta");
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
        yield* tick(writer.session);
        expect(textOf((yield* Ref.get(writer.state)).doc)).toBe("unsenta");
      })
  );

  it.effect(
    "keeps the rest of an editor's steps when its batch landed, and does not send the landed steps again",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const other = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* typeText(writer.state, "b");
        yield* tick(other.session);
        yield* TestClock.adjust(IDLE);
        yield* tick(other.session);
        expect(yield* server.counts).toMatchObject({
          head: 1,
          snapshotVersion: 1,
        });
        yield* server.prune(1);
        const dropped = yield* tick(writer.session);
        expect(Option.isNone(dropped)).toBe(true);
        expect(textOf((yield* Ref.get(writer.state)).doc)).toBe("ba");
        // Two batches in all: the one that landed before the reopen, and the step typed after it.
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
      })
  );

  it.effect(
    "reports the steps an editor lost when it opened again, once, and a step that throws counts as lost too",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        yield* typeText(writer.state, "wv");
        yield* tick(writer.session);
        const stale = yield* openEditor(server.transport);
        // "x" lands inside the text the writer deletes, and "y" past the end of the empty
        // document the server reopens from, so one step fails and one throws.
        yield* Ref.update(stale.state, (current) =>
          current.apply(current.tr.insertText("x", 2))
        );
        yield* Ref.update(stale.state, (current) =>
          current.apply(current.tr.insertText("y", 4))
        );
        // The writer deletes both letters, and the server takes the deletion.
        yield* Ref.update(writer.state, (current) =>
          current.apply(current.tr.delete(1, 3))
        );
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.transport.save({ content: EMPTY_DOCUMENT, version: 2 });
        yield* server.prune(2);
        const reported = yield* tick(stale.session);
        expect(reported).toEqual(
          Option.some(
            expect.objectContaining({ _tag: "SyncDropped", count: 2 })
          )
        );
        expect(textOf((yield* Ref.get(stale.state)).doc)).toBe("");
        expect(yield* tick(stale.session).pipe(Effect.map(Option.isNone))).toBe(
          true
        );
      })
  );
});

describe("editor/sync edits that land while a change is applied", () => {
  it.effect(
    "builds a received change again when an edit lands before it applies, and keeps both edits",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const { port, state } = yield* makePort();
        const reader = yield* startSync(port, server.transport);
        const raced = yield* Ref.make(false);
        const racing: SyncSession = {
          ...reader,
          port: {
            ...port,
            dispatch: (from, transaction) =>
              Effect.gen(function* () {
                if (!(yield* Ref.getAndSet(raced, true))) {
                  yield* typeText(state, "b");
                }
                return yield* port.dispatch(from, transaction);
              }),
          },
        };
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(racing);
        const readerState = yield* Ref.get(state);
        expect(["ab", "ba"]).toContain(textOf(readerState.doc));
        expect(getVersion(readerState)).toBe(1);
      })
  );

  it.effect(
    "builds a reopened state again when an edit lands before it replaces the state, and keeps the edit",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const { port, state } = yield* makePort();
        const reader = yield* startSync(port, server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* TestClock.adjust(IDLE);
        yield* tick(writer.session);
        yield* typeText(writer.state, "b");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.prune(1);
        const raced = yield* Ref.make(false);
        const racing: SyncSession = {
          ...reader,
          port: {
            ...port,
            replace: (from, next) =>
              Effect.gen(function* () {
                if (!(yield* Ref.getAndSet(raced, true))) {
                  yield* typeText(state, "c");
                }
                return yield* port.replace(from, next);
              }),
          },
        };
        yield* tick(racing);
        const readerState = yield* Ref.get(state);
        expect(textOf(readerState.doc)).toMatch(THREE_LETTERS);
        expect(getVersion(readerState)).toBe(2);
        expect(sendableSteps(readerState)).not.toBeNull();
      })
  );
});
