// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  balanceOf,
  cycleInvariant,
  FIELD,
  historyOf,
  periodOf,
  rateOf,
  stepOf,
} from "@repo/design-system/components/contents/biology/ecosystem/population";
import { Array as Arr, Option } from "effect";

describe("predator and prey", () => {
  it("balances at 100 rats and 20 owls, where nothing changes", () => {
    const balance = balanceOf(FIELD);
    expect(balance).toEqual({ predators: 20, prey: 100 });
    const rate = rateOf(balance, FIELD);
    expect(rate.prey).toBeCloseTo(0);
    expect(rate.predators).toBeCloseTo(0);
  });

  it("cycles about every six years and keeps its invariant", () => {
    expect(periodOf(FIELD)).toBeCloseTo(4.44, 1);
    const start = { predators: 10, prey: 150 };
    const history = historyOf(start, FIELD, 12, 0.5);
    expect(history).toHaveLength(25);
    const last = Option.getOrThrow(Arr.last(history));
    expect(cycleInvariant(last, FIELD)).toBeCloseTo(
      cycleInvariant(start, FIELD),
      3
    );
  });

  it("settles to a smaller balance when food limits the prey", () => {
    const limited = { ...FIELD, capacity: 400 };
    expect(balanceOf(limited)).toEqual({ predators: 15, prey: 100 });
    const history = historyOf({ predators: 10, prey: 150 }, limited, 60, 1);
    const last = Option.getOrThrow(Arr.last(history));
    expect(last.prey).toBeCloseTo(100, 0);
    expect(last.predators).toBeCloseTo(15, 0);
    expect(balanceOf({ ...FIELD, capacity: 50 }).predators).toBe(0);
  });

  it("keeps an empty field empty and lets owls starve without rats", () => {
    expect(stepOf({ predators: 0, prey: 0 }, FIELD, 0.01)).toEqual({
      predators: 0,
      prey: 0,
    });
    const starving = historyOf({ predators: 20, prey: 0 }, FIELD, 3, 1);
    const last = Option.getOrThrow(Arr.last(starving));
    expect(last.predators).toBeCloseTo(20 * Math.exp(-3), 3);
  });
});
