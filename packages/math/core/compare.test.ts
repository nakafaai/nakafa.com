import { compare } from "@repo/math/core/compare";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("compare", () => {
  afterEach(() => {
    vi.doUnmock("mathjs");
    vi.resetModules();
  });

  it("verifies equivalent expressions", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "(x + 2)^2",
        right: "x^2 + 4 * x + 4",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      status: "verified",
    });
  });

  it("verifies exactly equal symbolic expressions", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "x + 1",
        right: "x + 1",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      reason: "Math.js proved the expressions are symbolically equivalent.",
      status: "verified",
    });
  });

  it("contradicts expressions with a numeric counterexample", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "x + 1",
        right: "x + 2",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      samples: [
        {
          scope: {
            x: expect.any(Number),
          },
        },
      ],
      status: "contradicted",
    });
  });

  it("does not use undefined samples as counterexamples", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "(x^2 - 9) / (x - 3)",
        right: "x + 3",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      samples: [],
      status: "inconclusive",
    });
  });

  it("contradicts numeric expressions without variables", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "1",
        right: "2",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      samples: [
        {
          left: "1",
          right: "2",
          scope: {},
        },
      ],
      status: "contradicted",
    });
  });

  it("contradicts collection expressions through formatted values", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "[1, 2]",
        right: "[1, 3]",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      samples: [
        {
          left: "[1, 2]",
          right: "[1, 3]",
          scope: {},
        },
      ],
      status: "contradicted",
    });
  });

  it("contradicts boolean expressions through Math.js equality", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "true",
        right: "false",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      status: "contradicted",
    });
  });

  it("returns inconclusive when equality cannot be proven", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "sin(x)^2 + cos(x)^2",
        right: "1",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      status: "inconclusive",
    });
  });

  it("stays inconclusive when non-real symbolic checks cannot prove equality", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "sqrt(-1)",
        right: "i",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      status: "inconclusive",
    });
  });

  it("stays inconclusive when deterministic samples all match", async () => {
    const exit = await Effect.runPromiseExit(
      compare({
        left: "exp(i * pi)",
        right: "-1",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      status: "inconclusive",
    });
  });

  it("returns inconclusive when mocked deterministic samples match", async () => {
    vi.doMock("mathjs", () => ({
      equal: () => true,
      format: (value: unknown) => String(value),
      isSymbolNode: () => false,
      parse: (expression: string) => ({
        evaluate: () => 1,
        toString: () => expression,
        toTex: () => expression,
        traverse: () => undefined,
      }),
      rationalize: () => {
        throw new Error("rationalize failure");
      },
      symbolicEqual: () => false,
    }));

    const { compare: mockedCompare } = await import("@repo/math/core/compare");
    const exit = await Effect.runPromiseExit(
      mockedCompare({ left: "left", right: "right" })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value).toMatchObject({
      status: "inconclusive",
    });
  });
});
