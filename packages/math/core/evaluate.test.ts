import { evaluate } from "@repo/math/core/evaluate";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("evaluate", () => {
  it("evaluates numeric expressions", async () => {
    const exit = await Effect.runPromiseExit(
      evaluate({ expression: "2 + 3 * 4" })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      output: {
        value: "14",
      },
    });
  });

  it("keeps invalid numeric evaluation typed", async () => {
    const exit = await Effect.runPromiseExit(evaluate({ expression: "x + 2" }));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain("MathEvaluationError");
  });
});
