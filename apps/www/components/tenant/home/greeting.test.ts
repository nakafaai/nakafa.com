import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option } from "effect";
import {
  DAY_PART_ACT,
  dayPartAt,
  dayPartOf,
  firstNameOf,
} from "@/components/tenant/home/greeting";

const jakarta = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");

/** An instant read from its ISO text in UTC. */
const at = (iso: string) => DateTime.makeUnsafe(iso);

describe("dayPartOf", () => {
  it("names the morning from four o'clock, the afternoon from noon, and the evening from six", () => {
    expect(dayPartOf(4)).toBe("morning");
    expect(dayPartOf(11)).toBe("morning");
    expect(dayPartOf(12)).toBe("afternoon");
    expect(dayPartOf(17)).toBe("afternoon");
    expect(dayPartOf(18)).toBe("evening");
    expect(dayPartOf(23)).toBe("evening");
  });

  it("keeps the hours before four in the morning in the evening of the day before", () => {
    expect(dayPartOf(0)).toBe("evening");
    expect(dayPartOf(3)).toBe("evening");
  });
});

describe("dayPartAt", () => {
  it("reads the hour on the clock of the school's zone", () => {
    // 03:00 UTC is 10:00 in Jakarta, which is the morning there, though it is still the night in UTC.
    expect(dayPartAt(at("2026-10-18T03:00:00Z"), Option.some(jakarta))).toBe(
      "morning"
    );
    expect(dayPartAt(at("2026-10-18T03:00:00Z"), Option.none())).toBe(
      "evening"
    );
  });

  it("reads the hour on the UTC clock for a school with no zone", () => {
    expect(dayPartAt(at("2026-10-18T13:00:00Z"), Option.none())).toBe(
      "afternoon"
    );
  });
});

describe("DAY_PART_ACT", () => {
  it("gives Nina one act for each part of the day", () => {
    expect(DAY_PART_ACT).toEqual({
      afternoon: "typing",
      evening: "reading",
      morning: "waving",
    });
  });
});

describe("firstNameOf", () => {
  it("keeps the first word of the name", () => {
    expect(firstNameOf("Hendra Saputra")).toBe("Hendra");
  });

  it("keeps a single word as it is, and ignores the spaces at its ends", () => {
    expect(firstNameOf("  Sari ")).toBe("Sari");
  });
});
