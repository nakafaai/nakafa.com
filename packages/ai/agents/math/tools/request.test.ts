import {
  readArtifactDisplayCopy,
  readMathRequestInput,
} from "@repo/ai/agents/math/tools/request";
import type { MathToolInput } from "@repo/math/schema/tool-input";
import { describe, expect, it } from "vitest";

describe("math tool request", () => {
  it("keeps LLM display copy out of deterministic CAS requests", () => {
    const input = {
      display: {
        description: "Explain the line with $$m$$.",
        title: "Line artifact",
      },
      operation: "line",
      points: [
        { x: "0", y: "0" },
        { x: "3", y: "2" },
      ],
    } satisfies MathToolInput;

    expect(readArtifactDisplayCopy(input)).toEqual(input.display);
    expect(readMathRequestInput(input)).toEqual({
      operation: "line",
      points: [
        { x: "0", y: "0" },
        { x: "3", y: "2" },
      ],
    });
  });

  it("leaves non-artifact math requests unchanged", () => {
    const input = {
      expression: "6 * 7",
      operation: "evaluate",
    } satisfies MathToolInput;

    expect(readArtifactDisplayCopy(input)).toBeUndefined();
    expect(readMathRequestInput(input)).toEqual(input);
  });
});
