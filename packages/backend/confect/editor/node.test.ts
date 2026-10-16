import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import {
  AttributesSchema,
  AttributeValueSchema,
  fitsDocument,
  fitsSlice,
} from "@repo/backend/confect/editor/node";
import {
  nested,
  nestedArray,
  nestedAttrs,
} from "@repo/backend/test/editor/nodes";
import { Effect, Schema } from "effect";

describe("editor/node depth", () => {
  it("accepts a document exactly MAX_DOCUMENT_DEPTH node levels deep", () => {
    expect(fitsDocument(nested(MAX_DOCUMENT_DEPTH))).toBe(true);
  });

  it("refuses a document one node level deeper than the bound", () => {
    expect(fitsDocument(nested(MAX_DOCUMENT_DEPTH + 1))).toBe(false);
  });

  it("refuses a deep input without reading it past the bound", () => {
    expect(fitsDocument(nested(100_000))).toBe(false);
  });

  it("holds each node of a slice to the same depth", () => {
    expect(fitsSlice({ content: [nested(MAX_DOCUMENT_DEPTH)] })).toBe(true);
    expect(fitsSlice({ content: [nested(MAX_DOCUMENT_DEPTH + 1)] })).toBe(
      false
    );
  });

  it("leaves a shape it does not read to the schema", () => {
    expect(fitsDocument(7)).toBe(true);
    expect(fitsDocument({ content: "not a list", type: "doc" })).toBe(true);
  });
});

describe("editor/node attributes", () => {
  it.effect("accepts attributes nested exactly MAX_DOCUMENT_DEPTH levels", () =>
    Effect.gen(function* () {
      const attrs = nestedAttrs(MAX_DOCUMENT_DEPTH);
      expect(yield* Schema.decodeEffect(AttributesSchema)(attrs)).toEqual(
        attrs
      );
    })
  );

  it.effect("refuses attributes nested one level deeper than the bound", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(AttributesSchema)(
        nestedAttrs(MAX_DOCUMENT_DEPTH + 1)
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain(
        `at most ${MAX_DOCUMENT_DEPTH} levels deep`
      );
    })
  );

  it.effect(
    "counts each array of an attribute as a level, as each object",
    () =>
      Effect.gen(function* () {
        const value = nestedArray(MAX_DOCUMENT_DEPTH);
        expect(yield* Schema.decodeEffect(AttributeValueSchema)(value)).toEqual(
          value
        );
        const failure = yield* Schema.decodeEffect(AttributeValueSchema)(
          nestedArray(MAX_DOCUMENT_DEPTH + 1)
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect("refuses an attribute value one level deeper than the bound", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(AttributeValueSchema)(
        nestedAttrs(MAX_DOCUMENT_DEPTH + 1)
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "refuses attributes nested 100,000 levels without a stack overflow",
    () =>
      Effect.gen(function* () {
        const failure = yield* Schema.decodeEffect(AttributesSchema)(
          nestedAttrs(100_000)
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );
});
