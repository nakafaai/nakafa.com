import { MathToolInputSchema } from "@repo/math/schema/tool-input";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("MathToolInputSchema", () => {
  it("routes member inputs through the combined tool schema", () => {
    const decodeMathToolInput = Schema.decodeSync(MathToolInputSchema);

    expect(
      decodeMathToolInput({
        left: "(x^2 - 9)/(x - 3)",
        operation: "compare",
        right: "x + 3",
      })
    ).toEqual({
      left: "(x^2 - 9)/(x - 3)",
      operation: "compare",
      right: "x + 3",
    });

    expect(
      decodeMathToolInput({
        matrix: [
          ["2", "1"],
          ["0", "2"],
        ],
        operation: "eigen_analysis",
      })
    ).toEqual({
      matrix: [
        ["2", "1"],
        ["0", "2"],
      ],
      operation: "eigen_analysis",
    });
  });

  it("rejects incomplete member input", () => {
    expect(() =>
      Schema.decodeUnknownSync(MathToolInputSchema)({
        operation: "simplify",
      })
    ).toThrow();
  });
});
