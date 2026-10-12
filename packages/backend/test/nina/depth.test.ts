import { describe, expect, it } from "@effect/vitest";
import { deepest, deepestResult, levels } from "@repo/backend/test/nina/depth";
import { Schema, SchemaAST } from "effect";

describe("the levels Convex counts", () => {
  it("counts a scalar as none and a container as one more than its deepest member", () => {
    expect(levels("text")).toBe(0);
    expect(levels(null)).toBe(0);
    // A list of integers has one level, a list of lists two (size.rs).
    expect(levels([1, 2])).toBe(1);
    expect(levels([[1]])).toBe(2);
    expect(levels({})).toBe(1);
    expect(levels([])).toBe(1);
    expect(levels({ a: 1, b: [{ c: "x" }] })).toBe(3);
  });

  it("builds the deepest value a schema admits and counts it", () => {
    const schema = Schema.Struct({
      list: Schema.optionalKey(
        Schema.Array(Schema.Struct({ names: Schema.Array(Schema.String) }))
      ),
      pick: Schema.Union([
        Schema.String,
        Schema.Array(Schema.Array(Schema.Finite)),
      ]),
    });
    const value = deepest(SchemaAST.toType(schema.ast));
    expect(value).toEqual({
      list: [{ names: ["text"] }],
      pick: [[1]],
    });
    expect(levels(value)).toBe(4);
  });

  it("gives a schema that admits any depth a value deeper than Convex accepts", () => {
    expect(levels(deepest(Schema.Unknown.ast))).toBeGreaterThan(64);
  });

  it("builds a capability result with the cards that capability publishes and no others", () => {
    expect(deepestResult("memory")).toEqual({
      artifacts: [],
      outcome: "partial",
      text: "text",
    });
  });
});
