import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  chosenDays,
  dayOfMoment,
  dayRangeOf,
  fallsOnDays,
  holdsNoDays,
  withinDays,
} from "@/components/shared/table/days";

/** 30 Oct 2026 at 20:00 UTC: already 31 Oct on Jakarta's clock, still 30 Oct on London's. */
const EVENING = Date.UTC(2026, 9, 30, 20);

describe("the day of a moment", () => {
  it("reads the day the school's clock shows, not the day in UTC", () => {
    expect(dayOfMoment(EVENING, "Asia/Jakarta")).toBe("2026-10-31");
    expect(dayOfMoment(EVENING, "Europe/London")).toBe("2026-10-30");
  });
});

describe("a date column's chosen days", () => {
  it("puts two chosen days in their order", () => {
    expect(dayRangeOf("2026-10-31", "2026-10-01")).toEqual([
      "2026-10-01",
      "2026-10-31",
    ]);
  });

  it("reads a range the column holds, and none for a column that holds no range", () => {
    const range = ["2026-10-01", "2026-10-31"];
    expect(chosenDays({ added: range }, "added")).toEqual(Option.some(range));
    expect(chosenDays({}, "added")).toEqual(Option.none());
    expect(chosenDays({ added: [] }, "added")).toEqual(Option.none());
    expect(chosenDays({ added: ["owner"] }, "added")).toEqual(Option.none());
  });

  it("drops a choice that holds no range of days", () => {
    expect(holdsNoDays(undefined)).toBe(true);
    expect(holdsNoDays(["2026-10-01"])).toBe(true);
    expect(holdsNoDays(["2026-10-01", "2026-10-31"])).toBe(false);
  });
});

describe("the filter of a date column", () => {
  const onJakartaDays = (value: unknown, chosen: unknown) =>
    fallsOnDays(value, chosen, "Asia/Jakarta");

  it("keeps a moment whose day in the school's time zone is one of the chosen days, its first and last included", () => {
    expect(onJakartaDays(EVENING, ["2026-10-31", "2026-11-02"])).toBe(true);
    expect(onJakartaDays(EVENING, ["2026-10-29", "2026-10-31"])).toBe(true);
    expect(onJakartaDays(EVENING, ["2026-10-30", "2026-10-30"])).toBe(false);
  });

  it("keeps nothing for a cell that holds no moment, or a choice that holds no range", () => {
    expect(onJakartaDays("2026-10-31", ["2026-10-31", "2026-10-31"])).toBe(
      false
    );
    expect(onJakartaDays(EVENING, ["2026-10-31"])).toBe(false);
  });

  it("is a table filter that drops a column choosing no days", () => {
    const filter = withinDays(() => "Asia/Jakarta");
    expect(filter.autoRemove?.(["2026-10-31"])).toBe(true);
    expect(filter.autoRemove?.(["2026-10-31", "2026-10-31"])).toBe(false);
  });

  it("reads each row's moment on the clock of that row", () => {
    const filter = withinDays(({ zone }: { zone: string }) => zone);
    const onDay = (zone: string) =>
      filter.filter(
        EVENING,
        ["2026-10-31", "2026-10-31"],
        { original: { zone } } as never,
        "opens",
        () => undefined
      );

    expect(onDay("Asia/Jakarta")).toBe(true);
    expect(onDay("Europe/London")).toBe(false);
  });
});
