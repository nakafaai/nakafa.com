import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  formatSchoolTime,
  type SchoolTimeFormat,
} from "@repo/internationalization/src/school/time";
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
const WEEKDAY_AND_TIME = {
  de: "Di., 22:30",
  en: "Tue 10:30 PM",
  id: "Sel 22.30",
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
    "writes the weekday and the time of the school in %s",
    (locale) =>
      Effect.gen(function* () {
        expect(
          yield* schoolTime("weekdayTime", locale, "Asia/Jakarta", EVENING)
        ).toBe(WEEKDAY_AND_TIME[locale]);
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
