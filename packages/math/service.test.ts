import { MathService } from "@repo/math/service";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("Math", () => {
  it("provides deterministic math operations through the service boundary", async () => {
    const exit = await Effect.runPromiseExit(
      MathService.evaluate({ expression: "6 * 7" }).pipe(
        Effect.provide(MathService.Default)
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value.output.value).toBe("42");
  });
});
