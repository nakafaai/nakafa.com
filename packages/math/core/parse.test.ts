import { parseExpression } from "@repo/math/core/parse";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("parseExpression", () => {
  afterEach(() => {
    vi.doUnmock("mathjs");
    vi.resetModules();
  });

  it("parses valid expressions", async () => {
    const exit = await Effect.runPromiseExit(parseExpression("2 + 2"));

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("keeps parse failures readable", async () => {
    vi.doMock("mathjs", async () => {
      const actual = await vi.importActual<typeof import("mathjs")>("mathjs");

      return {
        ...actual,
        parse: () => {
          throw new Error("parse failure");
        },
      };
    });

    const { parseExpression: mockedParseExpression } = await import(
      "@repo/math/core/parse"
    );
    const exit = await Effect.runPromiseExit(mockedParseExpression("2"));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(exit.toString()).toContain("parse failure");
  });
});
