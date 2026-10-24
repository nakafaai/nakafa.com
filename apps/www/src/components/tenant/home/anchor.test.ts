import { describe, expect, it } from "@effect/vitest";
import { anchorAt, homeTime } from "@/components/tenant/home/anchor";

describe("tenant home anchor", () => {
  it("anchors the server's time at the device's time when the home renders", () => {
    expect(anchorAt(1000, 5000)).toStrictEqual({
      deviceNow: 5000,
      serverNow: 1000,
    });
  });

  it("reads the server's time at the anchor, moved on by the device time since then", () => {
    const anchor = anchorAt(1000, 5000);
    expect(homeTime(anchor, 5000)).toBe(1000);
    expect(homeTime(anchor, 8500)).toBe(4500);
  });

  it("is not moved by a device clock that is wrong when the anchor is taken", () => {
    // The device clock is ten minutes slow when the home renders, so only the time since then counts.
    const anchor = anchorAt(600_000, 1000);
    expect(homeTime(anchor, 1000 + 60_000)).toBe(660_000);
  });
});
