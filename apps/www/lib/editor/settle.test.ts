import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { nodeDepth } from "@repo/design-system/components/editor/depth";
import { encodeJsonText } from "@repo/utilities/json";
import type { Node } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { getVersion } from "prosemirror-collab";
import type { SyncSession } from "@/lib/editor/session";
import { tick } from "@/lib/editor/sync";
import {
  makeServer,
  nestedQuote,
  openEditor,
  settle,
  THREE_LETTERS,
  textOf,
  typeText,
} from "@/test/sync";

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
        // The server's fold skips the same step, so its snapshot holds the document the
        // editors share.
        yield* server.fold;
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
