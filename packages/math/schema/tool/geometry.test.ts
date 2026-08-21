import { MathGeometryInputSchema } from "@repo/math/schema/tool/geometry";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathGeometryInputSchema", () => {
  const decodeGeometryInput = Schema.decodeUnknownSync(MathGeometryInputSchema);

  it("requires the exact point count for each operation", () => {
    expect(
      decodeGeometryInput({
        operation: "distance",
        points: [
          { x: "1", y: "2" },
          { x: "4", y: "6" },
        ],
      })
    ).toEqual({
      operation: "distance",
      points: [
        { x: "1", y: "2" },
        { x: "4", y: "6" },
      ],
    });

    expect(() =>
      decodeGeometryInput({
        operation: "distance",
        points: [{ x: "1", y: "2" }],
      })
    ).toThrow();

    expect(() =>
      decodeGeometryInput({
        operation: "intersection",
        points: [
          { x: "0", y: "0" },
          { x: "1", y: "1" },
        ],
      })
    ).toThrow();
  });

  it("rejects malformed coordinate strings before CAS execution", () => {
    expect(() =>
      decodeGeometryInput({
        operation: "midpoint",
        points: [
          { x: "1", y: "2" },
          { x: "4,y:", y: "6" },
        ],
      })
    ).toThrow();
  });
});
