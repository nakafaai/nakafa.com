import { describe, expect, it } from "@effect/vitest";
import { summarizeWaits } from "@repo/backend/confect/nina/waits";
import { Array as Arr } from "effect";

type Turn = Parameters<typeof summarizeWaits>[0][number];

/** A turn that settled, with `wait` stored for the first stage it reaches. */
function waited(wait: number, index: number): Turn {
  return {
    _creationTime: index,
    phase: "settled",
    state: { status: "complete", finishedAt: index },
    timing: { claimedMs: wait },
  };
}

/** The row of every stage that `summarizeWaits` reports for turns that each waited one of `waits`. */
function rows(waits: readonly number[]) {
  return summarizeWaits(Arr.map(waits, waited)).waits;
}

describe("the nearest-rank spread of a wait", () => {
  it("takes the wait at rank ceil(percent / 100 * count) of the sorted waits", () => {
    // Ten different waits out of order, so a rank only means something after a sort.
    expect(rows([40, 10, 90, 20, 70, 30, 100, 60, 50, 80])).toContainEqual({
      max: 100,
      median: 50,
      min: 10,
      p90: 90,
      stage: "claimedMs",
      turns: 10,
    });
  });

  it("rounds a rank up to the next whole one, also when its fraction is below a half", () => {
    // 90 percent of eleven waits is rank 9.9, which is the tenth and not the
    // ninth. The median is rank 5.5, the sixth.
    expect(rows(Arr.range(1, 11))).toContainEqual({
      max: 11,
      median: 6,
      min: 1,
      p90: 10,
      stage: "claimedMs",
      turns: 11,
    });
    // 90 percent of six waits is rank 5.4, which is the sixth and not the
    // fifth that the nearest whole rank would give.
    expect(rows(Arr.range(1, 6))).toContainEqual({
      max: 6,
      median: 3,
      min: 1,
      p90: 6,
      stage: "claimedMs",
      turns: 6,
    });
  });

  it("gives a wait that occurred, the lower of the two in the middle for an even count", () => {
    // Interpolating between 10 and 20 would give 15, which no one waited.
    expect(rows([20, 10])).toContainEqual({
      max: 20,
      median: 10,
      min: 10,
      p90: 20,
      stage: "claimedMs",
      turns: 2,
    });
    expect(rows([4, 1, 3, 2])).toContainEqual({
      max: 4,
      median: 2,
      min: 1,
      p90: 4,
      stage: "claimedMs",
      turns: 4,
    });
    expect(rows([30, 10, 20])).toContainEqual({
      max: 30,
      median: 20,
      min: 10,
      p90: 30,
      stage: "claimedMs",
      turns: 3,
    });
  });

  it("gives the only wait of a single turn for every figure", () => {
    expect(rows([7])).toContainEqual({
      max: 7,
      median: 7,
      min: 7,
      p90: 7,
      stage: "claimedMs",
      turns: 1,
    });
  });

  it("keeps repeated waits", () => {
    expect(rows([3, 1, 3, 2])).toContainEqual({
      max: 3,
      median: 2,
      min: 1,
      p90: 3,
      stage: "claimedMs",
      turns: 4,
    });
  });
});
