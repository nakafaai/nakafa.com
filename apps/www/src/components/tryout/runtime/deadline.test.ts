import { describe, expect, it } from "@effect/vitest";
import { readDeadlineParts } from "@/components/tryout/runtime/deadline";

describe("readDeadlineParts", () => {
  it("reads a set window of more than a day in days, hours and minutes, never as 69 hours", () => {
    expect(readDeadlineParts(69 * 3600 + 26 * 60 + 35)).toEqual([
      { unit: "days", value: 2 },
      { unit: "hours", value: 21 },
      { unit: "minutes", value: 26 },
    ]);
  });

  it("reads its last day in hours, minutes and seconds, and a passed deadline as zero", () => {
    expect(readDeadlineParts(3600 + 61)).toEqual([
      { unit: "hours", value: 1 },
      { unit: "minutes", value: 1 },
      { unit: "seconds", value: 1 },
    ]);
    expect(readDeadlineParts(-5)).toEqual([
      { unit: "hours", value: 0 },
      { unit: "minutes", value: 0 },
      { unit: "seconds", value: 0 },
    ]);
  });
});
