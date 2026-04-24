import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatScheduledAt,
  getDefaultScheduledAt,
  getMinTime,
  getTimeString,
  updateDate,
  updateTime,
} from "@/components/school/classes/materials/utils";

describe("components/school/classes/materials/utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats scheduled timestamps and time strings", () => {
    const timestamp = new Date(2026, 3, 16, 8, 5).getTime();

    expect(getTimeString(timestamp)).toBe("08:05");
    expect(formatScheduledAt(timestamp, "en")).toContain("08:05");
    expect(formatScheduledAt(timestamp, "id")).toContain("08:05");
  });

  it("returns tomorrow at 8:00 as the default scheduled timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 30));

    expect(getDefaultScheduledAt()).toBe(new Date(2026, 3, 16, 8, 0).getTime());
  });

  it("keeps the current timestamp when the time input is cleared", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 0));

    const timestamp = new Date(2026, 3, 16, 8, 0).getTime();

    expect(updateTime(timestamp, "")).toBe(timestamp);
  });

  it("keeps the current timestamp when the time input is malformed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 0));

    const timestamp = new Date(2026, 3, 16, 8, 0).getTime();

    expect(updateTime(timestamp, "10")).toBe(timestamp);
  });

  it("updates the time when the new value is still in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 6, 0));

    const timestamp = new Date(2026, 3, 15, 8, 0).getTime();

    expect(updateTime(timestamp, "09:15")).toBe(
      new Date(2026, 3, 15, 9, 15).getTime()
    );
  });

  it("keeps the current timestamp when the new time would be in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 8, 30));

    const timestamp = new Date(2026, 3, 15, 9, 0).getTime();

    expect(updateTime(timestamp, "08:00")).toBe(timestamp);
  });

  it("moves same-day past selections to the next full hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 30));

    expect(updateDate(undefined, new Date(2026, 3, 15))).toBe(
      new Date(2026, 3, 15, 11, 0).getTime()
    );
  });

  it("rolls to the next day when the current hour is already 23", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 23, 30));

    expect(updateDate(undefined, new Date(2026, 3, 15))).toBe(
      new Date(2026, 3, 16, 0, 0).getTime()
    );
  });

  it("keeps future dates unchanged and preserves the existing time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 30));

    expect(
      updateDate(new Date(2026, 3, 16, 9, 30).getTime(), new Date(2026, 3, 17))
    ).toBe(new Date(2026, 3, 17, 9, 30).getTime());
  });

  it("uses 8:00 for future dates without an existing time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 30));

    expect(updateDate(undefined, new Date(2026, 3, 16))).toBe(
      new Date(2026, 3, 16, 8, 0).getTime()
    );
  });

  it("returns the current time for today and nothing for other dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 10, 45));

    expect(getMinTime(new Date(2026, 3, 15, 12, 0).getTime())).toBe("10:45");
    expect(getMinTime(new Date(2026, 3, 16, 12, 0).getTime())).toBeUndefined();
    expect(getMinTime(undefined)).toBeUndefined();
  });
});
