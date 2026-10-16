import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import {
  decodeStep,
  encodeStep,
  type Step,
  StepSchema,
} from "@repo/backend/confect/editor/step";
import { nested, nestedAttrs } from "@repo/backend/test/editor/nodes";
import { Effect, Schema } from "effect";

/** One step of each of the eight kinds, as ProseMirror's `toJSON` writes it. */
const steps: readonly Step[] = [
  {
    from: 1,
    slice: { content: [{ text: "ab", type: "text" }], openEnd: 1 },
    stepType: "replace",
    to: 3,
  },
  { from: 0, stepType: "replace", structure: true, to: 0 },
  {
    from: 2,
    gapFrom: 2,
    gapTo: 5,
    insert: 1,
    slice: { content: [{ type: "paragraph" }], openStart: 1 },
    stepType: "replaceAround",
    to: 5,
  },
  {
    from: 0,
    mark: { attrs: { href: "https://example.com" }, type: "link" },
    stepType: "addMark",
    to: 4,
  },
  { from: 0, mark: { type: "bold" }, stepType: "removeMark", to: 4 },
  { mark: { type: "italic" }, pos: 3, stepType: "addNodeMark" },
  { mark: { type: "italic" }, pos: 3, stepType: "removeNodeMark" },
  { attr: "level", pos: 0, stepType: "attr", value: 3 },
  { attr: "title", stepType: "docAttr", value: null },
];

/** Steps whose positions run backward. ProseMirror never writes one, and applying one duplicates or loses text. */
const backward: readonly Step[] = [
  {
    from: 5,
    slice: { content: [{ text: "ab", type: "text" }] },
    stepType: "replace",
    to: 2,
  },
  {
    from: 2,
    gapFrom: 5,
    gapTo: 3,
    insert: 0,
    stepType: "replaceAround",
    to: 6,
  },
  {
    from: 4,
    gapFrom: 2,
    gapTo: 3,
    insert: 0,
    stepType: "replaceAround",
    to: 6,
  },
  {
    from: 2,
    gapFrom: 3,
    gapTo: 5,
    insert: 0,
    stepType: "replaceAround",
    to: 4,
  },
  { from: 5, mark: { type: "bold" }, stepType: "addMark", to: 2 },
  { from: 5, mark: { type: "bold" }, stepType: "removeMark", to: 2 },
];

describe("editor/step storage form", () => {
  it.effect.each(steps)(
    "writes a $stepType step as JSON text and reads it back",
    (step) =>
      Effect.gen(function* () {
        const text = yield* encodeStep(step);
        expect(yield* decodeStep(text)).toEqual(step);
      })
  );

  it.effect("refuses a step kind ProseMirror does not write", () =>
    Effect.gen(function* () {
      const failure = yield* decodeStep(
        '{"stepType":"split","from":1,"to":2}'
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect("refuses a position below zero", () =>
    Effect.gen(function* () {
      const failure = yield* decodeStep(
        '{"mark":{"type":"bold"},"pos":-1,"stepType":"addNodeMark"}'
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect.each(backward)(
    "refuses a $stepType step whose positions run backward",
    (step) =>
      Effect.gen(function* () {
        const failure = yield* Schema.decodeEffect(StepSchema)(step).pipe(
          Effect.flip
        );
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect.each([
    { content: [{ text: "", type: "text" }], name: "an empty text" },
    { content: [{ type: "text" }], name: "a text node with no text" },
    { content: [], name: "no node at all" },
  ])("refuses a slice that holds $name", ({ content }) =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(StepSchema)({
        from: 0,
        slice: { content },
        stepType: "replace",
        to: 0,
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect("refuses a slice with a negative open level", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(StepSchema)({
        from: 0,
        slice: { content: [{ text: "a", type: "text" }], openStart: -1 },
        stepType: "replace",
        to: 0,
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "holds the nodes of a slice to the depth bound on read and on write",
    () =>
      Effect.gen(function* () {
        const atBound: Step = {
          from: 0,
          slice: { content: [nested(MAX_DOCUMENT_DEPTH)] },
          stepType: "replace",
          to: 0,
        };
        const text = yield* encodeStep(atBound);
        expect(yield* decodeStep(text)).toEqual(atBound);

        const beyond: Step = {
          from: 0,
          slice: { content: [nested(MAX_DOCUMENT_DEPTH + 1)] },
          stepType: "replace",
          to: 0,
        };
        const failure = yield* encodeStep(beyond).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
        expect(failure.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );
      })
  );

  it.effect(
    "holds the attributes of a step to the depth bound on read and on write",
    () =>
      Effect.gen(function* () {
        const atBound: Step = {
          mark: { attrs: nestedAttrs(MAX_DOCUMENT_DEPTH), type: "link" },
          pos: 0,
          stepType: "addNodeMark",
        };
        const text = yield* encodeStep(atBound);
        expect(yield* decodeStep(text)).toEqual(atBound);

        const beyond: Step = {
          attr: "level",
          pos: 0,
          stepType: "attr",
          value: nestedAttrs(MAX_DOCUMENT_DEPTH + 1),
        };
        const failure = yield* encodeStep(beyond).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
        expect(failure.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );

        const deepValue =
          '{"a":'.repeat(MAX_DOCUMENT_DEPTH) +
          "{}" +
          "}".repeat(MAX_DOCUMENT_DEPTH);
        const unread = yield* decodeStep(
          `{"attr":"level","pos":0,"stepType":"attr","value":${deepValue}}`
        ).pipe(Effect.flip);
        expect(unread._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "refuses a slice nested 100,000 levels without a stack overflow",
    () =>
      Effect.gen(function* () {
        const failure = yield* Schema.decodeEffect(StepSchema)({
          from: 0,
          slice: { content: [nested(100_000)] },
          stepType: "replace",
          to: 0,
        }).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "refuses a slice nested 100,000 levels on write without a stack overflow",
    () =>
      Effect.gen(function* () {
        const failure = yield* encodeStep({
          from: 0,
          slice: { content: [nested(100_000)] },
          stepType: "replace",
          to: 0,
        }).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );
});
