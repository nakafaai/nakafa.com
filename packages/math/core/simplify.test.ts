import { simplify } from "@repo/math/core/simplify";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("simplify", () => {
  afterEach(() => {
    vi.doUnmock("mathjs");
    vi.resetModules();
  });

  it("simplifies symbolic expressions", async () => {
    const exit = await Effect.runPromiseExit(
      simplify({ expression: "2 * x + 3 * x" })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      output: {
        expression: "5 * x",
      },
    });
  });

  it("keeps parse failures typed", async () => {
    const exit = await Effect.runPromiseExit(simplify({ expression: "2 +" }));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain("MathExpressionParseError");
  });

  it("keeps simplify failures readable", async () => {
    vi.doMock("mathjs", async () => {
      const actual = await vi.importActual<typeof import("mathjs")>("mathjs");

      return {
        ...actual,
        simplify: () => {
          throw new Error("simplify failure");
        },
      };
    });

    const { simplify: mockedSimplify } = await import(
      "@repo/math/core/simplify"
    );
    const exit = await Effect.runPromiseExit(
      mockedSimplify({ expression: "2 + 2" })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(exit.toString()).toContain("simplify failure");
  });
});
