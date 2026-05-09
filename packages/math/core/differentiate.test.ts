import { differentiate } from "@repo/math/core/differentiate";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("differentiate", () => {
  it("differentiates supported expressions", async () => {
    const exit = await Effect.runPromiseExit(
      differentiate({
        expression: "x^2 + 5 * x + 6",
        variable: "x",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      output: {
        expression: "2 * x + 5",
      },
      variable: "x",
    });
  });

  it("keeps unsupported derivatives typed", async () => {
    const exit = await Effect.runPromiseExit(
      differentiate({
        expression: "foo(x)",
        variable: "x",
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain("MathUnsupportedError");
  });
});
