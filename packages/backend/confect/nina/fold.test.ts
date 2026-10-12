import { describe, expect, it } from "@effect/vitest";
import { nextSummaryTarget } from "@repo/backend/confect/nina/fold";
import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Option } from "effect";

/** Turns of the orders `from` to `to`, each costing `tokens`, oldest first. */
function costs(from: number, to: number, tokens: number) {
  return Arr.map(Arr.range(from, to), (order) => ({ order, tokens }));
}

describe("Nina summary fold", () => {
  // The fold takes the budget as an argument, so these numbers stay small.
  const budget = 100;

  it("leaves turns that fit alone, at the budget and below it", () => {
    expect(nextSummaryTarget(null, [], budget)).toEqual(Option.none());
    expect(nextSummaryTarget(null, costs(0, 9, 10), budget)).toEqual(
      Option.none()
    );
    expect(nextSummaryTarget(null, costs(0, 19, 1), budget)).toEqual(
      Option.none()
    );
  });

  it("folds the oldest turns once they cost more than the budget, until the rest costs at most half of it", () => {
    // Eleven turns of 10 cost 110. The newest five cost 50, half the budget.
    expect(nextSummaryTarget(null, costs(0, 10, 10), budget)).toEqual(
      Option.some(5)
    );
    // One more turn folds one more.
    expect(nextSummaryTarget(null, costs(0, 11, 10), budget)).toEqual(
      Option.some(6)
    );
  });

  it("keeps the newest turn, whatever it costs", () => {
    expect(
      nextSummaryTarget(null, [{ order: 4, tokens: 150 }], budget)
    ).toEqual(Option.none());
    expect(
      nextSummaryTarget(
        null,
        [
          { order: 3, tokens: 30 },
          { order: 4, tokens: 150 },
        ],
        budget
      )
    ).toEqual(Option.some(3));
  });

  it("keeps the newest turn that costs at most half the budget, and folds the older", () => {
    expect(
      nextSummaryTarget(
        null,
        [
          { order: 0, tokens: 70 },
          { order: 1, tokens: 40 },
        ],
        budget
      )
    ).toEqual(Option.some(0));
  });

  it("folds at most one batch after what the summary covers", () => {
    // Forty turns of 10 cost 400, and the rest fits half the budget after 35 of them.
    const turns = costs(0, 39, 10);
    expect(nextSummaryTarget(null, turns, budget)).toEqual(
      Option.some(SUMMARY_FOLD_LIMIT - 1)
    );
    expect(nextSummaryTarget(15, turns, budget)).toEqual(
      Option.some(15 + SUMMARY_FOLD_LIMIT)
    );
  });

  it("decides the same from the newest turns alone once they outweigh the budget", () => {
    const all = costs(0, 55, 30);
    const newest = Arr.drop(all, 40);
    expect(nextSummaryTarget(15, newest, budget)).toEqual(
      nextSummaryTarget(15, all, budget)
    );
    expect(nextSummaryTarget(15, all, budget)).toEqual(
      Option.some(15 + SUMMARY_FOLD_LIMIT)
    );
  });
});
