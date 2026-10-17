import { describe, expect, it } from "@effect/vitest";
import { checkContent } from "@repo/backend/confect/editor/content";
import { Effect } from "effect";

describe("editor/slice containers", () => {
  it.effect(
    "accepts a bullet list that wraps a range, whose gap the step keeps and does not write",
    () =>
      Effect.gen(function* () {
        const accepted = yield* checkContent([
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
        ]).pipe(Effect.as(true));
        expect(accepted).toBe(true);
      })
  );

  it.effect("accepts an ordered list and a quote that wrap a range", () =>
    Effect.gen(function* () {
      const accepted = yield* checkContent([
        {
          from: 0,
          gapFrom: 0,
          gapTo: 7,
          insert: 2,
          slice: {
            content: [
              {
                attrs: { start: 1 },
                content: [{ type: "listItem" }],
                type: "orderedList",
              },
            ],
          },
          stepType: "replaceAround",
          to: 7,
        },
        {
          from: 0,
          gapFrom: 0,
          gapTo: 7,
          insert: 1,
          slice: { content: [{ type: "blockquote" }] },
          stepType: "replaceAround",
          to: 7,
        },
      ]).pipe(Effect.as(true));
      expect(accepted).toBe(true);
    })
  );

  it.effect(
    "accepts a lift that leaves a quote open at the end of its slice, whose rest stays in the document",
    () =>
      Effect.gen(function* () {
        const accepted = yield* checkContent([
          {
            from: 0,
            gapFrom: 1,
            gapTo: 6,
            insert: 0,
            slice: { content: [{ type: "blockquote" }], openEnd: 1 },
            stepType: "replaceAround",
            to: 6,
          },
        ]).pipe(Effect.as(true));
        expect(accepted).toBe(true);
      })
  );

  it.effect(
    "accepts a lift out of the middle of a quote, which leaves a quote open at each end of its slice",
    () =>
      Effect.gen(function* () {
        const accepted = yield* checkContent([
          {
            from: 6,
            gapFrom: 6,
            gapTo: 11,
            insert: 1,
            slice: {
              content: [{ type: "blockquote" }, { type: "blockquote" }],
              openEnd: 1,
              openStart: 1,
            },
            stepType: "replaceAround",
            to: 11,
          },
        ]).pipe(Effect.as(true));
        expect(accepted).toBe(true);
      })
  );

  it.effect(
    "refuses a list wrap whose gap lies deeper than its slice, so no list item is filled",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            gapFrom: 0,
            gapTo: 7,
            insert: 3,
            slice: {
              content: [
                { content: [{ type: "listItem" }], type: "bulletList" },
              ],
            },
            stepType: "replaceAround",
            to: 7,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect(
    "refuses an empty item beside an open one, since only the open item takes its content from the document",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            slice: {
              content: [
                {
                  content: [{ type: "listItem" }, { type: "listItem" }],
                  type: "bulletList",
                },
              ],
              openStart: 2,
            },
            stepType: "replace",
            to: 0,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect(
    "refuses a list wrap whose gap is empty, because no content fills its item",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            gapFrom: 0,
            gapTo: 0,
            insert: 2,
            slice: {
              content: [
                { content: [{ type: "listItem" }], type: "bulletList" },
              ],
            },
            stepType: "replaceAround",
            to: 0,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect(
    "refuses an empty list in a replace step, which holds no gap and no open edge",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            slice: { content: [{ type: "bulletList" }] },
            stepType: "replace",
            to: 0,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );

  it.effect(
    "refuses a list wrap whose start is not positive, although its item is filled",
    () =>
      Effect.gen(function* () {
        const failure = yield* checkContent([
          {
            from: 0,
            gapFrom: 0,
            gapTo: 7,
            insert: 2,
            slice: {
              content: [
                {
                  attrs: { start: 0 },
                  content: [{ type: "listItem" }],
                  type: "orderedList",
                },
              ],
            },
            stepType: "replaceAround",
            to: 7,
          },
        ]).pipe(Effect.flip);
        expect(failure._tag).toBe("BatchInvalid");
      })
  );
});
