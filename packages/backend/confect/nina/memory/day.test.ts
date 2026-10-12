import { describe, expect, it } from "@effect/vitest";
import { endOfDay, NinaMemoryDay } from "@repo/backend/confect/nina/memory/day";
import { Option, Schema } from "effect";

const readDay = Schema.decodeUnknownOption(NinaMemoryDay);

/** Texts that are no real UTC day written `YYYY-MM-DD`. */
const UNREAL_DAYS = [
  "2026-02-30",
  "2026-13-01",
  "2027-02-29",
  "20 Oktober",
  "tomorrow",
  "2026-10-20T10:00:00Z",
  "2026-1-5",
  "",
];

describe("memory end of day", () => {
  it("names the last millisecond of a real UTC day", () => {
    expect(endOfDay("2026-10-20")).toEqual(
      Option.some(Date.UTC(2026, 9, 20, 23, 59, 59, 999))
    );
    expect(endOfDay("2028-02-29")).toEqual(
      Option.some(Date.UTC(2028, 1, 29, 23, 59, 59, 999))
    );
  });

  it.each(UNREAL_DAYS)("names nothing for %j", (text) => {
    expect(endOfDay(text)).toEqual(Option.none());
  });
});

describe("memory day", () => {
  it("reads a real day as the text it is", () => {
    expect(readDay("2026-10-20")).toEqual(Option.some("2026-10-20"));
    expect(readDay("2028-02-29")).toEqual(Option.some("2028-02-29"));
  });

  it.each(UNREAL_DAYS)("refuses %j, which is no real day", (text) => {
    expect(readDay(text)).toEqual(Option.none());
  });
});
