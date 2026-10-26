// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  isTimeOfDay,
  joinLocalTime,
  splitLocalTime,
  timeSlots,
} from "@repo/design-system/lib/calendar/time";
import { Array as Arr, Option } from "effect";

describe("time of day", () => {
  it("accepts a time on the 24-hour clock to the minute", () => {
    expect(isTimeOfDay("00:00")).toBe(true);
    expect(isTimeOfDay("08:15")).toBe(true);
    expect(isTimeOfDay("23:59")).toBe(true);
  });

  it("refuses a time that the clock does not have", () => {
    expect(isTimeOfDay("24:00")).toBe(false);
    expect(isTimeOfDay("08:60")).toBe(false);
    expect(isTimeOfDay("8:15")).toBe(false);
    expect(isTimeOfDay("")).toBe(false);
  });
});

describe("time slots", () => {
  it("lists every step of the day from midnight", () => {
    const slots = timeSlots(15, "");

    expect(slots).toHaveLength(96);
    expect(Arr.take(slots, 3)).toEqual(["00:00", "00:15", "00:30"]);
    expect(Arr.last(slots)).toEqual(Option.some("23:45"));
  });

  it("keeps a chosen time that the step does not reach in its place", () => {
    const slots = timeSlots(30, "07:10");

    expect(Arr.take(Arr.drop(slots, 13), 4)).toEqual([
      "06:30",
      "07:00",
      "07:10",
      "07:30",
    ]);
    expect(slots).toHaveLength(49);
  });

  it("adds nothing for a chosen time that a slot already names or that is no time", () => {
    expect(timeSlots(30, "07:30")).toHaveLength(48);
    expect(timeSlots(30, "7:10")).toHaveLength(48);
  });
});

describe("local time", () => {
  it("splits a local time into its day and its time of day", () => {
    expect(splitLocalTime("2026-10-27T08:15")).toEqual(
      Option.some({ day: "2026-10-27", time: "08:15" })
    );
  });

  it("refuses text that is not a local time the clock has", () => {
    expect(splitLocalTime("")).toEqual(Option.none());
    expect(splitLocalTime("2026-10-27")).toEqual(Option.none());
    expect(splitLocalTime("2026-02-30T08:15")).toEqual(Option.none());
    expect(splitLocalTime("2026-10-27T25:00")).toEqual(Option.none());
  });

  it("joins a day and a time of day into a local time", () => {
    expect(joinLocalTime({ day: "2026-10-27", time: "08:15" })).toEqual(
      Option.some("2026-10-27T08:15")
    );
  });

  it("joins nothing while either half is missing", () => {
    expect(joinLocalTime({ day: "", time: "08:15" })).toEqual(Option.none());
    expect(joinLocalTime({ day: "2026-10-27", time: "" })).toEqual(
      Option.none()
    );
  });
});
