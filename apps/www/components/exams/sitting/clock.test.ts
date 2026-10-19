import { describe, expect, it } from "@effect/vitest";
import {
  serverClockOffset,
  serverTime,
} from "@/components/exams/sitting/clock";

describe("serverClockOffset", () => {
  it("reads the server's time against the middle of the round trip", () => {
    expect(
      serverClockOffset({ receivedAt: 1200, sentAt: 1000, serverNow: 1100 })
    ).toBe(0);
    expect(
      serverClockOffset({ receivedAt: 1200, sentAt: 1000, serverNow: 5100 })
    ).toBe(4000);
  });

  it("is negative when the device's clock runs ahead of the server", () => {
    expect(
      serverClockOffset({ receivedAt: 1200, sentAt: 1000, serverNow: 100 })
    ).toBe(-1000);
  });
});

describe("serverTime", () => {
  it("moves the device's time by the correction", () => {
    expect(serverTime(1000, 4000)).toBe(5000);
    expect(serverTime(1000, -1000)).toBe(0);
  });
});
