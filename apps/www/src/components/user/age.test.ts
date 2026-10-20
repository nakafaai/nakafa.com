import { describe, expect, it } from "@effect/vitest";
import { formatShortAge } from "@/components/user/age";

const NOW = Date.UTC(2026, 9, 17, 12);

describe("user/age", () => {
  it.each([
    [0, "now"],
    [59_999, "now"],
    [60_000, "1m ago"],
    [2 * 3_600_000, "2h ago"],
    [3 * 86_400_000, "3d ago"],
  ])("writes a post %i milliseconds old as %j", (elapsed, text) => {
    expect(formatShortAge(NOW - elapsed, NOW, "en")).toBe(text);
  });

  it("says now for a post written after the clock of this device", () => {
    expect(formatShortAge(NOW + 5000, NOW, "en")).toBe("now");
  });

  it("writes the age in the words of the locale", () => {
    const german = new Intl.RelativeTimeFormat("de", {
      numeric: "auto",
      style: "narrow",
    });
    expect(formatShortAge(NOW - 2 * 3_600_000, NOW, "de")).toBe(
      german.format(-2, "hour")
    );
  });
});
