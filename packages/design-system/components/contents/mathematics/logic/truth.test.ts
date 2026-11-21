// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  casesOf,
  LogicModeSchema,
  rowOf,
  truthOf,
  usesQ,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { Array as Arr } from "effect";

describe("compound statements", () => {
  it("offers and, or and not, and only not ignores q", () => {
    expect(LogicModeSchema.literals).toEqual(["and", "or", "not"]);
    expect(Arr.map(LogicModeSchema.literals, usesQ)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("writes the four cases of p and q with true first, and two for not p", () => {
    expect(casesOf("and")).toEqual([
      { p: true, q: true },
      { p: true, q: false },
      { p: false, q: true },
      { p: false, q: false },
    ]);
    expect(casesOf("not")).toEqual([
      { p: true, q: false },
      { p: false, q: false },
    ]);
  });

  it("lights the lamp in each compound's true rows", () => {
    const column = (mode: "and" | "or" | "not") =>
      Arr.map(casesOf(mode), (each) => truthOf(mode, each));
    expect(column("and")).toEqual([true, false, false, false]);
    expect(column("or")).toEqual([true, true, true, false]);
    expect(column("not")).toEqual([false, true]);
  });

  it("finds the row of every case, reading p alone for not p", () => {
    for (const mode of LogicModeSchema.literals) {
      Arr.forEach(casesOf(mode), (each, row) => {
        expect(rowOf(mode, each)).toBe(row);
      });
    }
    expect(rowOf("not", { p: true, q: true })).toBe(0);
    expect(rowOf("not", { p: false, q: true })).toBe(1);
  });
});
