import { describe, expect, it } from "@effect/vitest";
import { minutesLeft } from "@/components/tenant/home/left";

/** One minute in milliseconds, and a fixed reading of the clock. */
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 19, 2, 0);

describe("minutesLeft", () => {
  it("counts the whole minutes until the room closes", () => {
    expect(minutesLeft(NOW + 35 * MINUTE, NOW)).toBe(35);
  });

  it("counts a part of a minute as a whole minute", () => {
    expect(minutesLeft(NOW + 30_000, NOW)).toBe(1);
    expect(minutesLeft(NOW + MINUTE + 1, NOW)).toBe(2);
  });

  it("has no minute left once the room has closed", () => {
    expect(minutesLeft(NOW, NOW)).toBe(0);
    expect(minutesLeft(NOW - MINUTE, NOW)).toBe(0);
  });
});
