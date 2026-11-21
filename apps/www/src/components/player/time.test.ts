import { describe, expect, it } from "@effect/vitest";
import {
  formatClock,
  readTimeNotice,
  splitTime,
} from "@/components/player/time";

describe("player time", () => {
  it("splits seconds into hours, minutes, and seconds", () => {
    expect(splitTime(3725)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
    expect(splitTime(59)).toEqual({ hours: 0, minutes: 0, seconds: 59 });
    expect(splitTime(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it("formats durations as zero-padded clock strings", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(1800)).toBe("00:30:00");
    expect(formatClock(3725)).toBe("01:02:05");
  });

  it("warns once at five minutes and once at one minute", () => {
    expect(readTimeNotice(301)).toBe("none");
    expect(readTimeNotice(300)).toBe("five");
    expect(readTimeNotice(61)).toBe("five");
    expect(readTimeNotice(60)).toBe("one");
    expect(readTimeNotice(1)).toBe("one");
  });

  it("says nothing once the time is up", () => {
    expect(readTimeNotice(0)).toBe("none");
  });
});
