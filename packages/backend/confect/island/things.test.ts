import { describe, expect, it } from "@effect/vitest";
import {
  balanceOf,
  isOpen,
  openBlueprint,
  priceOf,
  spentOn,
} from "@repo/backend/confect/island/things";
import { Result } from "effect";

describe("island/things", () => {
  it("reads the balance as the lifetime Stars less the blueprints opened, never below nothing", () => {
    expect(priceOf("mango")).toBe(0);
    expect(priceOf("lighthouse")).toBe(120);
    expect(spentOn([])).toBe(0);
    expect(spentOn(["cottage", "kite"])).toBe(65);
    expect(balanceOf(100, ["cottage", "kite"])).toBe(35);
    expect(balanceOf(50, ["cottage", "kite"])).toBe(0);
  });

  it("builds a free thing from the first day and a priced one once its blueprint is open", () => {
    expect(isOpen("bench", [])).toBe(true);
    expect(isOpen("boat", [])).toBe(false);
    expect(isOpen("boat", ["boat"])).toBe(true);
  });

  it("opens a blueprint for its price, once, and refuses one the balance does not reach", () => {
    expect(openBlueprint(40, [], "cottage")).toEqual(
      Result.succeed({ balance: 0, blueprints: ["cottage"] })
    );
    const short = openBlueprint(69, ["cottage"], "saung");
    expect(Result.isFailure(short) && short.failure).toMatchObject({
      _tag: "Short",
      balance: 29,
      price: 30,
    });
    // One already open, and a free one, cost nothing and change nothing.
    expect(openBlueprint(40, ["cottage"], "cottage")).toEqual(
      Result.succeed({ balance: 0, blueprints: ["cottage"] })
    );
    expect(openBlueprint(0, [], "bench")).toEqual(
      Result.succeed({ balance: 0, blueprints: [] })
    );
  });
});
