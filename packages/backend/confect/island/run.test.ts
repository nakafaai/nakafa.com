import { describe, expect, it } from "@effect/vitest";
import { runBack, runOn } from "@repo/backend/confect/island/run";
import { HashSet } from "effect";

const days = HashSet.fromIterable([
  "2026-11-01",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
  "2026-11-09",
  "2026-11-10",
]);

describe("island/run", () => {
  it("counts try-out days in a row back from a day, at most a week, and stops at a missed day", () => {
    expect(runBack(days, "2026-11-10")).toBe(7);
    expect(runBack(days, "2026-11-04")).toBe(2);
    expect(runBack(days, "2026-11-02")).toBe(0);
  });

  it("keeps the run alive through today until the learner tries, and drops it after a missed day", () => {
    expect(runOn(days, "2026-11-05")).toBe(3);
    expect(runOn(days, "2026-11-11")).toBe(7);
    expect(runOn(days, "2026-11-12")).toBe(0);
  });
});
