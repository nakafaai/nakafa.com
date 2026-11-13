import { describe, expect, it } from "@effect/vitest";
import {
  dayBefore,
  streakAfter,
  streakOn,
  summaryOf,
  weekOf,
} from "@repo/backend/confect/island/week";

describe("island/week", () => {
  it("names the week a day falls in, Monday first, across a month's end", () => {
    expect(weekOf("2026-11-09")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(weekOf("2026-11-01")[0]).toBe("2026-10-26");
    expect(weekOf("2026-11-01")[6]).toBe("2026-11-01");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
  });

  it("grows the run on the day after, keeps it on the same day, and starts again after a gap", () => {
    expect(streakAfter(undefined, 0, "2026-11-09")).toBe(1);
    expect(streakAfter("2026-11-08", 4, "2026-11-09")).toBe(5);
    expect(streakAfter("2026-11-09", 5, "2026-11-09")).toBe(5);
    expect(streakAfter("2026-11-06", 9, "2026-11-09")).toBe(1);
  });

  it("shows the run while it is alive today, and none once a day was missed", () => {
    expect(streakOn("2026-11-09", 3, "2026-11-09")).toBe(3);
    expect(streakOn("2026-11-08", 3, "2026-11-09")).toBe(3);
    expect(streakOn("2026-11-07", 3, "2026-11-09")).toBe(0);
    expect(streakOn(undefined, 0, "2026-11-09")).toBe(0);
  });

  it("sums one day's grants by kind and Stars", () => {
    expect(
      summaryOf("2026-11-09", [
        { kind: "lesson", stars: 5 },
        { kind: "lesson", stars: 5 },
        { kind: "section", stars: 15 },
        { kind: "set", stars: 40 },
      ] as const)
    ).toEqual({
      day: "2026-11-09",
      lessons: 2,
      sections: 1,
      sets: 1,
      stars: 65,
    });
    expect(summaryOf("2026-11-10", [])).toEqual({
      day: "2026-11-10",
      lessons: 0,
      sections: 0,
      sets: 0,
      stars: 0,
    });
  });
});
