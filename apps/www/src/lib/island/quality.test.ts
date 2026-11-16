// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { RUNGS, stepLadder, TOP_RUNG } from "@/lib/island/quality";

/** The ladder after `count` frames of `seconds` each. */
const after = (ladder: typeof TOP_RUNG, seconds: number, count: number) =>
  Arr.reduce(
    Arr.makeBy(count, () => seconds),
    ladder,
    stepLadder
  );

describe("island/quality", () => {
  it("keeps the full picture on a device that holds sixty frames a second", () => {
    const steady = after(TOP_RUNG, 1 / 60, 600);
    expect(steady.rung).toBe(0);
    expect(RUNGS[steady.rung]).toEqual({
      coarse: false,
      shadows: true,
      tufts: true,
    });
  });

  it("steps down a rung after two seconds over budget, rung by rung, and stays on the lowest", () => {
    const first = after(TOP_RUNG, 1 / 25, 70);
    expect(first.rung).toBe(1);
    expect(RUNGS[first.rung].tufts).toBe(false);
    const second = after(first, 1 / 25, 70);
    expect(second.rung).toBe(2);
    expect(RUNGS[second.rung].shadows).toBe(false);
    const third = after(second, 1 / 25, 70);
    expect(third.rung).toBe(3);
    expect(RUNGS[third.rung].coarse).toBe(true);
    expect(after(third, 1 / 25, 200).rung).toBe(3);
    expect(after(third, 1 / 60, 600).rung).toBe(3);
  });

  it("forgives a short stall and says nothing of a frame after a pause", () => {
    const stalled = after(TOP_RUNG, 1 / 25, 30);
    const calm = after(stalled, 1 / 60, 60);
    expect(calm.slow).toBe(0);
    expect(after(calm, 1 / 25, 30).rung).toBe(0);
    expect(stepLadder(TOP_RUNG, 2)).toEqual(TOP_RUNG);
    expect(stepLadder(TOP_RUNG, 0)).toEqual(TOP_RUNG);
  });
});
