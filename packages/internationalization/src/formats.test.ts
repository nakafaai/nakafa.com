import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  formatAge,
  formatBytes,
  formatSchoolTime,
  formatterOf,
  type SchoolTimeFormat,
} from "@repo/internationalization/src/formats";
import { DateTime, Effect, Record as Rec } from "effect";

/** An instant read from its ISO text in UTC. */
const at = (iso: string) => DateTime.makeUnsafe(iso);

/** 6 October 2026, 15:30 UTC: 10:30 PM in Jakarta, 5:30 PM in Berlin, 6:30 PM in Riyadh. */
const EVENING = at("2026-10-06T15:30:00Z");
/** 16 October 2026, 18:30 UTC: 1:30 AM on 17 October in Jakarta, 8:30 PM on 16 October in Berlin, and 9:30 PM on 16 October in Riyadh. */
const ACROSS_MIDNIGHT = at("2026-10-16T18:30:00Z");
/** A reading of the clock well after the instants above, so that it names no relative day. */
const LATER = at("2026-10-20T03:00:00Z");

/** The time of `EVENING` in the zone of each school, in English. */
const TIME_IN_ZONE = {
  "Asia/Jakarta": "10:30 PM",
  "Europe/Berlin": "5:30 PM",
  "Asia/Riyadh": "6:30 PM",
};

/** How each locale writes `EVENING` in Jakarta: a date, a time, and both. */
const DATE = { de: "06.10.2026", en: "Oct 6, 2026", id: "6 Okt 2026" };
const TIME = { de: "22:30", en: "10:30 PM", id: "22.30" };
const DATE_AND_TIME = {
  de: "06.10.2026, 22:30",
  en: "Oct 6, 2026, 10:30 PM",
  id: "6 Okt 2026, 22.30",
};

/** How each locale writes the weekday and the time of `EVENING` in Jakarta. */
const DAY_AND_TIME = {
  de: "6. Okt., 22:30",
  en: "Oct 6, 10:30 PM",
  id: "6 Okt, 22.30",
};

/**
 * How each locale names the day of `ACROSS_MIDNIGHT` in Jakarta when that day is
 * today, when it is yesterday, and as a date when it is neither.
 */
const TODAY = { de: "heute", en: "today", id: "hari ini" };
const YESTERDAY = { de: "gestern", en: "yesterday", id: "kemarin" };
const OLDER = { de: "17.10.2026", en: "Oct 17, 2026", id: "17 Okt 2026" };

/** Writes one school time for a reading of the clock, which defaults to `LATER`. */
function schoolTime(
  format: SchoolTimeFormat,
  locale: ActiveAppLocaleCode,
  timeZone: string,
  instant: DateTime.Utc,
  now = LATER
) {
  return formatSchoolTime({ format, instant, locale, now, timeZone });
}

describe("formatSchoolTime", () => {
  it.effect.each(Rec.keys(TIME_IN_ZONE))(
    "writes the same instant in %s",
    (timeZone) =>
      Effect.gen(function* () {
        expect(yield* schoolTime("time", "en", timeZone, EVENING)).toBe(
          TIME_IN_ZONE[timeZone]
        );
      })
  );

  it.effect.each(["GMT", "GMT0", "GMT+0", "GMT-0"])(
    "writes a school in %s at the UTC time, since the platform keeps it as a zone",
    (timeZone) =>
      Effect.gen(function* () {
        expect(yield* schoolTime("time", "en", timeZone, EVENING)).toBe(
          "3:30 PM"
        );
      })
  );

  it.effect("writes the date on the school's own day across midnight", () =>
    Effect.gen(function* () {
      expect(
        yield* schoolTime("date", "en", "Asia/Jakarta", ACROSS_MIDNIGHT)
      ).toBe("Oct 17, 2026");
      expect(
        yield* schoolTime("date", "en", "Europe/Berlin", ACROSS_MIDNIGHT)
      ).toBe("Oct 16, 2026");
      expect(
        yield* schoolTime("date", "en", "Asia/Riyadh", ACROSS_MIDNIGHT)
      ).toBe("Oct 16, 2026");
    })
  );

  it.effect("names the relative day on the school's own calendar", () =>
    Effect.gen(function* () {
      const now = at("2026-10-17T03:00:00Z");

      expect(
        yield* schoolTime(
          "relativeDay",
          "en",
          "Asia/Jakarta",
          ACROSS_MIDNIGHT,
          now
        )
      ).toBe("today");
      expect(
        yield* schoolTime(
          "relativeDay",
          "en",
          "Europe/Berlin",
          ACROSS_MIDNIGHT,
          now
        )
      ).toBe("yesterday");
      expect(
        yield* schoolTime(
          "relativeDay",
          "en",
          "Asia/Riyadh",
          ACROSS_MIDNIGHT,
          now
        )
      ).toBe("yesterday");
    })
  );

  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "writes a date, a time, and both in %s",
    (locale) =>
      Effect.gen(function* () {
        expect(yield* schoolTime("date", locale, "Asia/Jakarta", EVENING)).toBe(
          DATE[locale]
        );
        expect(yield* schoolTime("time", locale, "Asia/Jakarta", EVENING)).toBe(
          TIME[locale]
        );
        expect(
          yield* schoolTime("dateTime", locale, "Asia/Jakarta", EVENING)
        ).toBe(DATE_AND_TIME[locale]);
      })
  );

  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "writes the day, the month and the time of the school in %s",
    (locale) =>
      Effect.gen(function* () {
        expect(
          yield* schoolTime("dayTime", locale, "Asia/Jakarta", EVENING)
        ).toBe(DAY_AND_TIME[locale]);
      })
  );

  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "names the relative day in %s, and a date on any other day",
    (locale) =>
      Effect.gen(function* () {
        expect(
          yield* schoolTime(
            "relativeDay",
            locale,
            "Asia/Jakarta",
            ACROSS_MIDNIGHT,
            at("2026-10-17T03:00:00Z")
          )
        ).toBe(TODAY[locale]);
        expect(
          yield* schoolTime(
            "relativeDay",
            locale,
            "Asia/Jakarta",
            ACROSS_MIDNIGHT,
            at("2026-10-18T03:00:00Z")
          )
        ).toBe(YESTERDAY[locale]);
        expect(
          yield* schoolTime(
            "relativeDay",
            locale,
            "Asia/Jakarta",
            ACROSS_MIDNIGHT
          )
        ).toBe(OLDER[locale]);
      })
  );

  it.effect.each(["Mars/Olympus", "+07:00", "+0700", ""])(
    "refuses %j, which is not an IANA time zone",
    (timeZone) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          schoolTime("date", "en", timeZone, EVENING)
        );

        expect(error).toMatchObject({
          _tag: "SchoolTimeZoneError",
          timeZone,
        });
      })
  );
});

const NOW = Date.UTC(2026, 9, 17, 12);
const DAY = 86_400_000;

describe("formatAge", () => {
  it.each([
    [0, "now"],
    [59_999, "now"],
    [60_000, "1 minute ago"],
    [2 * 3_600_000, "2 hours ago"],
    [DAY, "1 day ago"],
    [1.5 * DAY, "1 day ago"],
    [3 * DAY, "3 days ago"],
    [45 * DAY, "1 month ago"],
    [92 * DAY, "3 months ago"],
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

describe("formatBytes", () => {
  it.each([
    [500_000, "en", "500\u00a0kB"],
    [250_000_000, "en", "250\u00a0MB"],
    [10_200_000_000, "en", "10.2\u00a0GB"],
    [10_200_000_000, "de", "10,2\u00a0GB"],
    [1_000_000_000_000, "id", "1\u00a0TB"],
  ] as const)(
    "writes %i bytes in %s as %j, its number and unit held together",
    (bytes, locale, text) => {
      expect(formatBytes(bytes, locale)).toBe(text);
    }
  );
});

/** `EVENING` in milliseconds, as a list row passes a moment. */
const EVENING_MILLIS = DateTime.toEpochMillis(EVENING);

describe("formatterOf", () => {
  // 1 October 2026 at UTC midnight: the evening of 30 September west of UTC and in no zone a day later.
  const FIRST = Date.UTC(2026, 9, 1);

  it("writes a calendar day kept as UTC midnight on its own day in every locale zone", () => {
    expect(formatterOf("en").dateTime(FIRST, "calendar")).toBe("Oct 1, 2026");
    expect(formatterOf("de").dateTime(FIRST, "calendarLong")).toBe(
      "1. Oktober 2026"
    );
    expect(formatterOf("id").dateTime(FIRST, "calendar")).toBe("1 Okt 2026");
  });

  it("writes a moment in the locale's own zone unless the call names one", () => {
    expect(formatterOf("id").dateTime(EVENING_MILLIS, "time")).toBe("22.30");
    expect(
      formatterOf("en").dateTime(EVENING_MILLIS, "time", {
        timeZone: "Europe/Berlin",
      })
    ).toBe("5:30 PM");
  });

  it("writes a billing day in Jakarta for every reader", () => {
    expect(
      formatterOf("de").dateTime(Date.UTC(2026, 9, 31, 17), "billing")
    ).toBe("1. November 2026");
  });

  it("writes numbers and lists in the locale's own words", () => {
    expect(formatterOf("de").number(1234.567, "math")).toBe("1234,57");
    expect(formatterOf("en").number(0.5, "trig")).toBe("0.50");
    expect(formatterOf("id").list(["a", "b", "c"], "or")).toBe("a, b, atau c");
  });
});
