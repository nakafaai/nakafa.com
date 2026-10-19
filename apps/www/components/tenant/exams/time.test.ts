import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option } from "effect";
import { nextQuarter, sittingTimes } from "@/components/tenant/exams/time";

const jakarta = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");
const berlin = DateTime.zoneMakeNamedUnsafe("Europe/Berlin");

/** The instant that an ISO text names with its Z. */
const instant = (iso: string) => DateTime.makeUnsafe(iso);

/** The epoch milliseconds of an ISO text that names its zone with a Z. */
const millis = (iso: string) => DateTime.toEpochMillis(instant(iso));

describe("nextQuarter", () => {
  it("names the next quarter hour on the wall clock of the zone", () => {
    expect(nextQuarter(instant("2026-10-18T03:07:00Z"), jakarta)).toBe(
      "2026-10-18T10:15"
    );
  });

  it("is strictly after the instant, so a quarter hour that has just begun is not the answer", () => {
    expect(nextQuarter(instant("2026-10-18T03:15:00Z"), jakarta)).toBe(
      "2026-10-18T10:30"
    );
  });

  it("rolls over midnight into the next day", () => {
    expect(nextQuarter(instant("2026-10-18T16:50:00Z"), jakarta)).toBe(
      "2026-10-19T00:00"
    );
  });

  it("skips the hour that a spring change in Berlin does not have", () => {
    expect(nextQuarter(instant("2026-03-29T00:50:00Z"), berlin)).toBe(
      "2026-03-29T03:00"
    );
  });
});

describe("sittingTimes", () => {
  it("opens at the start on the wall clock of the zone and closes after the length", () => {
    expect(sittingTimes("2026-10-18T10:15", 60, jakarta)).toEqual(
      Option.some({
        closesAt: millis("2026-10-18T04:15:00Z"),
        opensAt: millis("2026-10-18T03:15:00Z"),
      })
    );
  });

  it("counts the length in real minutes across a spring change in Berlin", () => {
    expect(sittingTimes("2026-03-29T01:30", 90, berlin)).toEqual(
      Option.some({
        closesAt: millis("2026-03-29T02:00:00Z"),
        opensAt: millis("2026-03-29T00:30:00Z"),
      })
    );
  });

  it("reads the wall clock after a spring change in Berlin", () => {
    expect(sittingTimes("2026-03-29T03:30", 60, berlin)).toEqual(
      Option.some({
        closesAt: millis("2026-03-29T02:30:00Z"),
        opensAt: millis("2026-03-29T01:30:00Z"),
      })
    );
  });

  it("is none for text that is not a datetime-local value", () => {
    expect(sittingTimes("2026-10-18 10:15", 60, jakarta)).toEqual(
      Option.none()
    );
    expect(sittingTimes("", 60, jakarta)).toEqual(Option.none());
  });

  it("is none for a day that the calendar does not have", () => {
    expect(sittingTimes("2026-02-30T10:00", 60, jakarta)).toEqual(
      Option.none()
    );
  });
});
