import {
  formatExpression,
  formatValue,
  getErrorMessage,
} from "@repo/math/core/format";
import * as math from "mathjs";
import { describe, expect, it } from "vitest";

describe("format", () => {
  it("formats Math.js values", () => {
    expect(formatValue(1 / 3)).toBe("0.33333333333333");
  });

  it("formats Math.js expression nodes", () => {
    const node = math.parse("x + 1");

    expect(formatExpression(node)).toMatchObject({
      expression: "x + 1",
      latex: " x+1",
    });
  });

  it("reads Error messages", () => {
    expect(getErrorMessage(new Error("broken"))).toBe("broken");
  });

  it("stringifies unknown failures", () => {
    expect(getErrorMessage("raw failure")).toBe("raw failure");
  });
});
