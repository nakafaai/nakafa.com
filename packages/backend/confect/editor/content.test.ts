import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { checkContent } from "@repo/backend/confect/editor/content";
import type { DocumentNode } from "@repo/backend/confect/editor/node";
import { newDocument, nf, stepRows } from "@repo/backend/test/editor";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

describe("editor/content refusals", () => {
  it.effect(
    "refuses a heading level outside the contract's levels 1 to 3",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            slice: {
              content: [
                {
                  attrs: { level: 4 },
                  content: [{ text: "x", type: "text" }],
                  type: "heading",
                },
              ],
            },
            stepType: "replace",
            to: 0,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect("accepts the heading levels 1 to 3 that the contract allows", () =>
    Effect.gen(function* () {
      const accepted = yield* checkContent([
        {
          from: 0,
          slice: {
            content: Arr.map(Arr.make(1, 2, 3), (level) => ({
              attrs: { level },
              content: [{ text: "x", type: "text" }],
              type: "heading",
            })),
          },
          stepType: "replace",
          to: 0,
        },
      ]).pipe(Effect.as(true));
      expect(accepted).toBe(true);
    })
  );

  it.effect("refuses a link to an address that is not https in a slice", () =>
    Effect.gen(function* () {
      const failure = yield* checkContent([
        {
          from: 0,
          slice: {
            content: [
              {
                content: [
                  {
                    marks: [
                      { attrs: { href: "http://nakafa.com" }, type: "link" },
                    ],
                    text: "x",
                    type: "text",
                  },
                ],
                type: "paragraph",
              },
            ],
          },
          stepType: "replace",
          to: 0,
        },
      ]).pipe(Effect.flip);
      expect(failure._tag).toBe("BatchInvalid");
    })
  );

  it.effect(
    "refuses a link mark added to text at an address that is not https",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            mark: { attrs: { href: "ftp://nakafa.com" }, type: "link" },
            stepType: "addMark",
            to: 1,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect("accepts an https link in a paragraph", () =>
    Effect.gen(function* () {
      const accepted = yield* checkContent([
        {
          from: 0,
          slice: {
            content: [
              {
                content: [
                  {
                    marks: [
                      { attrs: { href: "https://nakafa.com" }, type: "link" },
                    ],
                    text: "x",
                    type: "text",
                  },
                ],
                type: "paragraph",
              },
            ],
          },
          stepType: "replace",
          to: 0,
        },
      ]).pipe(Effect.as(true));
      expect(accepted).toBe(true);
    })
  );

  it.effect(
    "refuses marks out of the contract's order, with the link before bold",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            slice: {
              content: [
                {
                  content: [
                    {
                      marks: [
                        { attrs: { href: "https://nakafa.com" }, type: "link" },
                        { type: "bold" },
                      ],
                      text: "x",
                      type: "text",
                    },
                  ],
                  type: "paragraph",
                },
              ],
            },
            stepType: "replace",
            to: 0,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect("accepts bold before the link, in the contract's order", () =>
    Effect.gen(function* () {
      const accepted = yield* checkContent([
        {
          from: 0,
          slice: {
            content: [
              {
                content: [
                  {
                    marks: [
                      { type: "bold" },
                      { attrs: { href: "https://nakafa.com" }, type: "link" },
                    ],
                    text: "x",
                    type: "text",
                  },
                ],
                type: "paragraph",
              },
            ],
          },
          stepType: "replace",
          to: 0,
        },
      ]).pipe(Effect.as(true));
      expect(accepted).toBe(true);
    })
  );

  it.effect(
    "refuses a list item the contract reads inside its list, when its first child is not a paragraph",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            slice: {
              content: [
                {
                  content: [{ text: "x", type: "text" }],
                  type: "listItem",
                },
              ],
            },
            stepType: "replace",
            to: 0,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect(
    "accepts a list item at the top of a slice, which a split of a list writes",
    () =>
      Effect.gen(function* () {
        const accepted = yield* checkContent([
          {
            from: 0,
            slice: {
              content: [
                {
                  content: [
                    {
                      content: [{ text: "x", type: "text" }],
                      type: "paragraph",
                    },
                  ],
                  type: "listItem",
                },
              ],
              openEnd: 2,
              openStart: 2,
            },
            stepType: "replace",
            to: 0,
          },
        ]).pipe(Effect.as(true));
        expect(accepted).toBe(true);
      })
  );

  it.effect(
    "accepts each kind of step that writes no node content, and the marks of the mark steps",
    () =>
      Effect.gen(function* () {
        const accepted = yield* checkContent([
          { from: 0, stepType: "replace", to: 1 },
          {
            from: 0,
            gapFrom: 0,
            gapTo: 0,
            insert: 0,
            slice: { content: [{ type: "paragraph" }] },
            stepType: "replaceAround",
            to: 0,
          },
          { from: 0, mark: { type: "bold" }, stepType: "removeMark", to: 1 },
          { mark: { type: "italic" }, pos: 0, stepType: "addNodeMark" },
          { mark: { type: "italic" }, pos: 0, stepType: "removeNodeMark" },
          { attr: "level", pos: 0, stepType: "attr", value: 2 },
          { attr: "title", stepType: "docAttr", value: "Soal" },
        ]).pipe(Effect.as(true));
        expect(accepted).toBe(true);
      })
  );

  it.effect(
    "refuses a node mark added to a node at an address that is not https",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            mark: { attrs: { href: "http://nakafa.com" }, type: "link" },
            pos: 0,
            stepType: "addNodeMark",
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );
});

const { submit } = refs.public.editor.steps;

/** A batch of one step that inserts the node at the start of the document, encoded as a client sends it. */
const nodeBatch = Effect.fn("test.editor.content.nodeBatch")(function* (
  node: DocumentNode
) {
  return yield* encodeBatch({
    baseVersion: 0,
    batch: "rina-node",
    clientId: "rina",
    steps: [
      { from: 0, slice: { content: [node] }, stepType: "replace", to: 0 },
    ],
  }).pipe(Effect.orDie);
});

describe("editor/content at submit", () => {
  it.effect(
    "refuses a batch whose heading level the contract refuses, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const text = yield* nodeBatch({
          attrs: { level: 4 },
          content: [{ text: "x", type: "text" }],
          type: "heading",
        });
        const failure = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "BatchInvalid" });
        expect(yield* fixture.run(stepRows)).toHaveLength(0);
      })
  );

  it.effect(
    "refuses a batch whose link is not an https address, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const text = yield* nodeBatch({
          content: [
            {
              marks: [{ attrs: { href: "http://nakafa.com" }, type: "link" }],
              text: "x",
              type: "text",
            },
          ],
          type: "paragraph",
        });
        const failure = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "BatchInvalid" });
        expect(yield* fixture.run(stepRows)).toHaveLength(0);
      })
  );

  it.effect(
    "accepts a batch whose heading level and link address the contract accepts",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const text = yield* nodeBatch({
          attrs: { level: 3 },
          content: [
            {
              marks: [{ attrs: { href: "https://nakafa.com" }, type: "link" }],
              text: "x",
              type: "text",
            },
          ],
          type: "heading",
        });
        const accepted = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf });
        expect(accepted).toEqual({ head: 1 });
        expect(yield* fixture.run(stepRows)).toHaveLength(1);
      })
  );

  it.effect(
    "accepts a batch that wraps a range in a bullet list, and writes its one step",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const text = yield* encodeBatch({
          baseVersion: 0,
          batch: "rina-wrap",
          clientId: "rina",
          steps: [
            {
              from: 0,
              gapFrom: 0,
              gapTo: 7,
              insert: 2,
              slice: {
                content: [
                  { content: [{ type: "listItem" }], type: "bulletList" },
                ],
              },
              stepType: "replaceAround",
              to: 7,
            },
          ],
        }).pipe(Effect.orDie);
        const accepted = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf });
        expect(accepted).toEqual({ head: 1 });
        expect(yield* fixture.run(stepRows)).toHaveLength(1);
      })
  );
});
