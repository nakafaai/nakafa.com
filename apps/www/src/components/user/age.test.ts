import { describe, expect, it } from "@effect/vitest";
import { formatAge } from "@/components/user/age";

const NOW = Date.UTC(2026, 9, 17, 12);
const DAY = 86_400_000;

describe("user/age", () => {
  it.each([
    [0, "now"],
    [59_999, "now"],
    [60_000, "1 minute ago"],
    [2 * 3_600_000, "2 hours ago"],
    [DAY, "1 day ago"],
    [3 * DAY, "3 days ago"],
    [45 * DAY, "1 month ago"],
    [90 * DAY, "3 months ago"],
    [800 * DAY, "2 years ago"],
  ])("writes a post %i milliseconds old as %j", (elapsed, text) => {
    expect(formatAge(NOW - elapsed, NOW, "en")).toBe(text);
  });

  it("says now for a post written after the clock of this device", () => {
    expect(formatAge(NOW + 5000, NOW, "en")).toBe("now");
  });

  it.each([
    [30_000, "sekarang"],
    [6 * 3_600_000, "6 jam yang lalu"],
    [DAY, "1 hari yang lalu"],
    [2 * DAY, "2 hari yang lalu"],
    [6 * DAY, "6 hari yang lalu"],
    [400 * DAY, "1 tahun yang lalu"],
  ])(
    "spells an Indonesian age %i milliseconds old in full words, never h, thn or selumbari: %j",
    (elapsed, text) => {
      expect(formatAge(NOW - elapsed, NOW, "id")).toBe(text);
    }
  );

  it("spells a German age in full words", () => {
    expect(formatAge(NOW - 2 * DAY, NOW, "de")).toBe("vor 2 Tagen");
  });
});
