import {
  evaluateSample,
  getScopes,
  getSymbols,
  valuesMatch,
} from "@repo/math/core/sample";
import { Effect, Option } from "effect";
import * as math from "mathjs";
import { describe, expect, it } from "vitest";

describe("sample", () => {
  it("collects symbols from expression nodes", () => {
    expect(getSymbols([math.parse("x + y + 1")])).toEqual(["x", "y"]);
  });

  it("creates one empty scope for constant expressions", () => {
    expect(getScopes([])).toEqual([{}]);
  });

  it("creates deterministic scopes for symbolic expressions", () => {
    expect(getScopes(["x"])).toEqual([
      { x: -3 },
      { x: -1 },
      { x: 1 },
      { x: 3 },
      { x: 5 },
      { x: 7 },
      { x: 9 },
    ]);
  });

  it("compares close numeric values", () => {
    expect(valuesMatch(1, 1 + 1e-12)).toBe(true);
  });

  it("compares non-boolean Math.js equality through formatting", () => {
    expect(valuesMatch(math.matrix([1, 2]), math.matrix([1, 2]))).toBe(true);
  });

  it("returns a sampled value when evaluation succeeds", async () => {
    const value = await Effect.runPromise(
      evaluateSample({
        node: math.parse("x + 1"),
        scope: { x: 2 },
      })
    );

    expect(Option.isSome(value)).toBe(true);
  });

  it("returns none when evaluation fails for a scope", async () => {
    const value = await Effect.runPromise(
      evaluateSample({
        node: math.parse("1 / y"),
        scope: { x: 2 },
      })
    );

    expect(Option.isNone(value)).toBe(true);
  });
});
