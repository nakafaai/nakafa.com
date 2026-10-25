import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, DateTime } from "effect";
import { SCHEDULE_DAYS, scheduleDays } from "@/components/tenant/home/strip";

const JAKARTA = "Asia/Jakarta";

/** The epoch milliseconds of an ISO instant, so each test names its moment in a readable form. */
const at = (iso: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso));

/** A room that opens at an instant on the clock of a time zone. */
const room = (id: string, opensAt: string, timeZone = JAKARTA) => ({
  id,
  opensAt: at(opensAt),
  timeZone,
});

/** Ten in the morning on the 24th of October in Jakarta. */
const NOW = at("2026-10-24T03:00:00Z");

/** The calendar day and the id of each room that the columns hold, in the order of the columns. */
const placed = <Room extends { readonly id: string }>(
  days: readonly { readonly key: string; readonly rooms: readonly Room[] }[]
) =>
  Arr.flatMap(days, (day) =>
    Arr.map(day.rooms, (item) => ({ id: item.id, key: day.key }))
  );

describe("tenant home schedule", () => {
  it("has no columns when no room is listed", () => {
    expect(scheduleDays([], NOW)).toEqual([]);
  });

  it("draws today and the fourteen days after it, so every room has its column", () => {
    const days = scheduleDays([room("first", "2026-10-24T08:00:00Z")], NOW);
    const dayNumbers = Arr.map(days, (day) => day.day);

    expect(days).toHaveLength(SCHEDULE_DAYS);
    expect(days[0]?.key).toBe("2026-10-24");
    expect(days[SCHEDULE_DAYS - 1]?.key).toBe("2026-11-07");
    expect(dayNumbers[0]).toBe(24);
    expect(dayNumbers[SCHEDULE_DAYS - 1]).toBe(7);
  });

  it("marks only today's column", () => {
    const days = scheduleDays([room("first", "2026-10-24T08:00:00Z")], NOW);

    expect(
      Arr.map(
        Arr.filter(days, (day) => day.today),
        (day) => day.key
      )
    ).toEqual(["2026-10-24"]);
  });

  it("puts each room in the column of its own day on the unit's clock", () => {
    const days = scheduleDays(
      [
        room("today", "2026-10-24T08:00:00Z"),
        room("later", "2026-10-26T07:00:00Z"),
        room("last", "2026-11-07T03:00:00Z"),
      ],
      NOW
    );

    expect(placed(days)).toEqual([
      { id: "today", key: "2026-10-24" },
      { id: "later", key: "2026-10-26" },
      { id: "last", key: "2026-11-07" },
    ]);
  });

  it("stacks the rooms of one day in their listed order", () => {
    const days = scheduleDays(
      [
        room("early", "2026-10-24T05:00:00Z"),
        room("late", "2026-10-24T09:00:00Z"),
      ],
      NOW
    );

    expect(placed(days)).toEqual([
      { id: "early", key: "2026-10-24" },
      { id: "late", key: "2026-10-24" },
    ]);
  });

  it("leaves out a room that opens after the last column", () => {
    const days = scheduleDays([room("beyond", "2026-11-09T03:00:00Z")], NOW);

    expect(placed(days)).toEqual([]);
  });
});
