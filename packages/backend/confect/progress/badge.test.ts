import { describe, expect, it } from "@effect/vitest";
import {
  countsOf,
  markOf,
  reachedBadges,
  tallyAfter,
  tierOf,
} from "@repo/backend/confect/progress/badge";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import { Array as Arr } from "effect";

describe("progress/badge", () => {
  it("reaches a tier at 1, 2 and 5 times every power of ten, without a last one", () => {
    expect(Arr.map(Arr.range(1, 10), markOf)).toEqual([
      1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
    ]);
    expect(markOf(19)).toBe(1_000_000);
    expect(Arr.map([0, 1, 4, 5, 9, 10, 999, 1000], tierOf)).toEqual([
      0, 1, 2, 3, 3, 4, 9, 10,
    ]);
    expect(tierOf(1_000_000)).toBe(19);
  });

  it("counts each kind of learning, a day once, and the longest run of days", () => {
    const first = tallyAfter(
      EMPTY_TALLY,
      { _tag: "lesson", content: "limits", subject: "mathematics" },
      true,
      1
    );
    const second = tallyAfter(
      first,
      { _tag: "lesson", content: "sets", subject: "mathematics" },
      false,
      1
    );
    const third = tallyAfter(
      { ...second, streak: 9 },
      { _tag: "section", section: "one", set: "snbt" },
      true,
      2
    );
    const last = tallyAfter(third, { _tag: "set", set: "snbt" }, false, 2);
    expect(last).toEqual({
      days: 2,
      lessons: 2,
      sections: 1,
      sets: 1,
      streak: 9,
      subjects: { mathematics: 2 },
    });
    expect(countsOf(last)).toEqual({
      days: 2,
      lessons: 2,
      mathematics: 2,
      sections: 1,
      sets: 1,
      streak: 9,
    });
  });

  it("names only the tiers a tally newly reached, a new subject among them", () => {
    const before = { ...EMPTY_TALLY, lessons: 4, subjects: { physics: 3 } };
    const after = {
      ...before,
      lessons: 5,
      subjects: { biology: 1, physics: 4 },
    };
    expect(reachedBadges(before, after)).toEqual([
      { name: "lessons", tier: 3 },
      { name: "biology", tier: 1 },
    ]);
    expect(reachedBadges(after, after)).toEqual([]);
  });
});
