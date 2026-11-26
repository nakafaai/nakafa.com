import { describe, expect, it } from "@effect/vitest";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import { MaterialSchema } from "@repo/contents/taxonomy";
import { MedalSchema } from "@repo/mascot/medal/name";
import { Array as Arr } from "effect";
import {
  bestOf,
  emptyWeek,
  levelProgress,
  medalsOf,
  progressSummary,
  wallOf,
  weekBars,
} from "@/components/progress/level";

/** One day of a week with these Stars and nothing else counted. */
function day(date: string, stars: number) {
  return { day: date, lessons: 0, sections: 0, sets: 0, stars };
}

describe("progress/level", () => {
  it("derives level thresholds and tally from a growth record, defaulting to level 1", () => {
    expect(progressSummary(null)).toEqual({
      from: 0,
      level: 1,
      lifetime: 0,
      next: 100,
      tally: EMPTY_TALLY,
    });
    const tally = { ...EMPTY_TALLY, days: 2, lessons: 5 };
    expect(progressSummary({ lifetime: 175, tally })).toEqual({
      from: 100,
      level: 2,
      lifetime: 175,
      next: 250,
      tally,
    });
  });

  it("measures the way to the next level from the level reached", () => {
    expect(levelProgress({ from: 100, lifetime: 175, next: 250 })).toEqual({
      left: 75,
      share: 0.5,
    });
    expect(levelProgress({ from: 250, lifetime: 250, next: 450 })).toEqual({
      left: 200,
      share: 0,
    });
  });

  it("shows the five kinds of learning always, and a subject once a lesson of it counts", () => {
    expect(Arr.map(wallOf(EMPTY_TALLY), (medal) => medal.name)).toEqual([
      "days",
      "streak",
      "lessons",
      "sections",
      "sets",
    ]);
    const wall = wallOf({
      ...EMPTY_TALLY,
      days: 3,
      lessons: 7,
      subjects: { mathematics: 5, physics: 2 },
    });
    // The earned medals stand first, then the kinds still to earn.
    expect(wall).toEqual([
      { count: 3, from: 2, name: "days", next: 5, share: 1 / 3, tier: 2 },
      { count: 7, from: 5, name: "lessons", next: 10, share: 0.4, tier: 3 },
      { count: 5, from: 5, name: "mathematics", next: 10, share: 0, tier: 3 },
      { count: 2, from: 2, name: "physics", next: 5, share: 0, tier: 2 },
      { count: 0, from: 0, name: "streak", next: 1, share: 0, tier: 0 },
      { count: 0, from: 0, name: "sections", next: 1, share: 0, tier: 0 },
      { count: 0, from: 0, name: "sets", next: 1, share: 0, tier: 0 },
    ]);
  });

  it("lists every medal for a profile, and picks the highest tiers for the pane, the larger count first", () => {
    const tally = {
      ...EMPTY_TALLY,
      days: 3,
      lessons: 7,
      subjects: { mathematics: 5, physics: 6 },
    };
    expect(medalsOf(tally)).toHaveLength(MedalSchema.literals.length);
    expect(Arr.map(bestOf(wallOf(tally), 3), (medal) => medal.name)).toEqual([
      "lessons",
      "physics",
      "mathematics",
    ]);
  });

  it("has a medal for every subject Nakafa presents, so no counted lesson lacks one", () => {
    expect(MedalSchema.literals).toEqual(
      expect.arrayContaining([...MaterialSchema.literals])
    );
  });

  it("draws each day against the best day of the week, and knows today and the days to come", () => {
    const week = weekBars(
      [
        day("2026-11-09", 10),
        day("2026-11-10", 40),
        day("2026-11-11", 0),
        day("2026-11-12", 0),
      ],
      "2026-11-11"
    );
    expect(week.stars).toBe(50);
    expect(week.learnedToday).toBe(false);
    expect(week.bars).toEqual([
      { ahead: false, day: "2026-11-09", share: 0.25, stars: 10, today: false },
      { ahead: false, day: "2026-11-10", share: 1, stars: 40, today: false },
      { ahead: false, day: "2026-11-11", share: 0, stars: 0, today: true },
      { ahead: true, day: "2026-11-12", share: 0, stars: 0, today: false },
    ]);
  });

  it("counts today once it has Stars, and stands an empty week on a floor of one", () => {
    expect(weekBars([day("2026-11-11", 5)], "2026-11-11").learnedToday).toBe(
      true
    );
    expect(weekBars([], "2026-11-11")).toEqual({
      bars: [],
      learnedToday: false,
      stars: 0,
    });
  });

  it("builds seven empty days for the current UTC week before the learner earns their first Star", () => {
    const empty = emptyWeek(Date.UTC(2026, 10, 26, 9, 0, 0));
    expect(empty.today).toBe("2026-11-26");
    expect(empty.days).toHaveLength(7);
    expect(empty.days[0]).toEqual(day("2026-11-23", 0));
    expect(empty.days[6]).toEqual(day("2026-11-29", 0));
    const bars = weekBars(empty.days, empty.today);
    expect(bars.stars).toBe(0);
    expect(bars.learnedToday).toBe(false);
    expect(bars.bars[3]).toEqual({
      ahead: false,
      day: "2026-11-26",
      share: 0,
      stars: 0,
      today: true,
    });
    expect(bars.bars[4]?.ahead).toBe(true);
  });
});
