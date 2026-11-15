import { describe, expect, it } from "@effect/vitest";
import { SetLevelSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import {
  setLevelFilterValidator,
  setLevelRank,
  setLevelValidator,
} from "@repo/backend/confect/tryouts/sets/query";
import { Array as Arr } from "effect";

describe("tryouts/sets/query", () => {
  it("names the contract's levels in the contract's order", () => {
    expect(setLevelValidator.literals).toEqual(SetLevelSchema.literals);
  });

  it("filters by every level or by one", () => {
    expect(setLevelFilterValidator.literals).toEqual([
      "all",
      ...SetLevelSchema.literals,
    ]);
  });

  it("ranks the levels from easy up to cooked", () => {
    expect(Arr.map(SetLevelSchema.literals, setLevelRank)).toEqual([
      0, 1, 2, 3,
    ]);
  });
});
