// @vitest-environment node
import { afterEach, describe, expect, it } from "@effect/vitest";
import { DateTime, Duration } from "effect";
import { formatAge, formatPublished } from "@/lib/i18n/date";

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const MOMENT = Date.UTC(2026, 9, 6, 15, 30, 0);

/**
 * The module as it loads in a time zone. Its formatters are built when it
 * loads, and the two of a moment read the zone of the viewer then, so each zone
 * loads the module afresh.
 */
async function loadIn(zone: string) {
  vi.stubEnv("TZ", zone);
  vi.resetModules();
  return await import("@/lib/i18n/date");
}

/** The moment that lies `age` before `NOW`, months and years counted on the calendar. */
const before = (age: Partial<DateTime.DateTime.PartsForMath>) =>
  DateTime.toEpochMillis(DateTime.subtract(DateTime.makeUnsafe(NOW), age));

/**
 * Each age with the words that date-fns 4.4.0 wrote for it in German, English,
 * and Indonesian, taken once with `addSuffix` on before the package left. They
 * are the words the interface showed, so `formatAge` must write the same ones:
 * the hedges ("about", "over", "almost"), the phrase for under a minute, and
 * the line between one unit and the next.
 */
const AGES = [
  {
    label: "29 seconds",
    at: before({ seconds: 29 }),
    de: "vor weniger als 1 Minute",
    en: "less than a minute ago",
    id: "kurang dari 1 menit yang lalu",
  },
  {
    label: "30 seconds",
    at: before({ seconds: 30 }),
    de: "vor 1 Minute",
    en: "1 minute ago",
    id: "1 menit yang lalu",
  },
  {
    label: "44 minutes",
    at: before({ minutes: 44 }),
    de: "vor 44 Minuten",
    en: "44 minutes ago",
    id: "44 menit yang lalu",
  },
  {
    label: "44 minutes 30 seconds",
    at: before({ minutes: 44, seconds: 30 }),
    de: "vor etwa 1 Stunde",
    en: "about 1 hour ago",
    id: "sekitar 1 jam yang lalu",
  },
  {
    label: "89 minutes 30 seconds",
    at: before({ minutes: 89, seconds: 30 }),
    de: "vor etwa 2 Stunden",
    en: "about 2 hours ago",
    id: "sekitar 2 jam yang lalu",
  },
  {
    label: "23 hours 59 minutes 29 seconds",
    at: before({ hours: 23, minutes: 59, seconds: 29 }),
    de: "vor etwa 24 Stunden",
    en: "about 24 hours ago",
    id: "sekitar 24 jam yang lalu",
  },
  {
    label: "23 hours 59 minutes 30 seconds",
    at: before({ hours: 23, minutes: 59, seconds: 30 }),
    de: "vor 1 Tag",
    en: "1 day ago",
    id: "1 hari yang lalu",
  },
  {
    label: "36 hours",
    at: before({ hours: 36 }),
    de: "vor 1 Tag",
    en: "1 day ago",
    id: "1 hari yang lalu",
  },
  {
    label: "42 hours",
    at: before({ hours: 42 }),
    de: "vor 2 Tagen",
    en: "2 days ago",
    id: "2 hari yang lalu",
  },
  {
    label: "29 days 23 hours 59 minutes",
    at: before({ days: 29, hours: 23, minutes: 59 }),
    de: "vor 30 Tagen",
    en: "30 days ago",
    id: "30 hari yang lalu",
  },
  {
    label: "30 days",
    at: before({ days: 30 }),
    de: "vor etwa 1 Monat",
    en: "about 1 month ago",
    id: "sekitar 1 bulan yang lalu",
  },
  {
    label: "45 days",
    at: before({ days: 45 }),
    de: "vor etwa 2 Monaten",
    en: "about 2 months ago",
    id: "sekitar 2 bulan yang lalu",
  },
  {
    label: "60 days",
    at: before({ days: 60 }),
    de: "vor 2 Monaten",
    en: "2 months ago",
    id: "2 bulan yang lalu",
  },
  {
    label: "364 days",
    at: before({ days: 364 }),
    de: "vor 12 Monaten",
    en: "12 months ago",
    id: "12 bulan yang lalu",
  },
  {
    label: "365 days, a year",
    at: before({ days: 365 }),
    de: "vor etwa 1 Jahr",
    en: "about 1 year ago",
    id: "sekitar 1 tahun yang lalu",
  },
  {
    label: "18 months",
    at: before({ months: 18 }),
    de: "vor mehr als 1 Jahr",
    en: "over 1 year ago",
    id: "lebih dari 1 tahun yang lalu",
  },
  {
    label: "21 months",
    at: before({ months: 21 }),
    de: "vor fast 2 Jahren",
    en: "almost 2 years ago",
    id: "hampir 2 tahun yang lalu",
  },
];

/**
 * Each moment of an attempt, in UTC, with the words that date-fns wrote for its
 * `PPp` format in German, English, and Indonesian. The hour has two digits in
 * the 24-hour languages, German puts no comma before the time, and English
 * writes the 12-hour clock without a leading zero.
 */
const MOMENTS = [
  {
    at: MOMENT,
    de: "6. Okt. 2026 15:30",
    en: "Oct 6, 2026, 3:30 PM",
    id: "6 Okt 2026, 15.30",
  },
  {
    at: Date.UTC(2026, 9, 6, 0, 5),
    de: "6. Okt. 2026 00:05",
    en: "Oct 6, 2026, 12:05 AM",
    id: "6 Okt 2026, 00.05",
  },
  {
    at: Date.UTC(2026, 9, 6, 9, 5),
    de: "6. Okt. 2026 09:05",
    en: "Oct 6, 2026, 9:05 AM",
    id: "6 Okt 2026, 09.05",
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("formatAge", () => {
  for (const { at, de, en, id, label } of AGES) {
    it(`says an age of ${label} in each language`, () => {
      expect(formatAge(at, "en", NOW)).toBe(en);
      expect(formatAge(at, "id", NOW)).toBe(id);
      expect(formatAge(at, "de", NOW)).toBe(de);
    });
  }

  it("reads a moment after now as an age under a minute", () => {
    expect(
      formatAge(NOW + Duration.toMillis(Duration.minutes(5)), "en", NOW)
    ).toBe("less than a minute ago");
    expect(
      formatAge(NOW + Duration.toMillis(Duration.days(2)), "de", NOW)
    ).toBe("vor weniger als 1 Minute");
  });

  it("counts a month as whole once the later moment is as far into its month as the earlier one", () => {
    // 31 March 2021 to 30 June 2024 is 38 whole months, because June has no 31st.
    const now = Date.UTC(2024, 5, 30, 9, 0, 0);
    const timestamp = Date.UTC(2021, 2, 31, 8, 0, 0);

    expect(formatAge(timestamp, "en", now)).toBe("about 3 years ago");
    expect(formatAge(timestamp, "id", now)).toBe("sekitar 3 tahun yang lalu");
    expect(formatAge(timestamp, "de", now)).toBe("vor etwa 3 Jahren");
  });

  it("counts the time that passed, whatever the clocks did", () => {
    vi.stubEnv("TZ", "Europe/Berlin");
    // The clocks of Berlin jump from 02:00 to 03:00 at 01:00 UTC on 29 March
    // 2026, so over 40 minutes their hands move by 100.
    const now = Date.UTC(2026, 2, 29, 1, 10);

    expect(formatAge(Date.UTC(2026, 2, 29, 0, 30), "en", now)).toBe(
      "40 minutes ago"
    );
  });

  it("writes English for an unsupported or absent locale", () => {
    const timestamp = before({ days: 3 });

    expect(formatAge(timestamp, "fr", NOW)).toBe("3 days ago");
    expect(formatAge(timestamp, null, NOW)).toBe("3 days ago");
    expect(formatAge(timestamp, undefined, NOW)).toBe("3 days ago");
  });

  it("counts from the current time when no moment is named", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    expect(formatAge(before({ hours: 5 }), "en")).toBe("about 5 hours ago");
  });
});

describe("formatMoment", () => {
  it("writes the moment in the order and words of each language", async () => {
    const { formatMoment } = await loadIn("UTC");

    for (const { at, de, en, id } of MOMENTS) {
      expect(formatMoment(at, "en")).toBe(en);
      expect(formatMoment(at, "id")).toBe(id);
      expect(formatMoment(at, "de")).toBe(de);
    }
  });

  // The platform spells two short months otherwise than date-fns did: August
  // in Indonesian ("Agt" before) and September in German ("Sep." before).
  it("spells the short month as the platform does", async () => {
    const { formatMoment } = await loadIn("UTC");

    expect(formatMoment(Date.UTC(2026, 7, 5, 18, 52), "id")).toBe(
      "5 Agu 2026, 18.52"
    );
    expect(formatMoment(Date.UTC(2026, 8, 21, 18, 52), "de")).toBe(
      "21. Sept. 2026 18:52"
    );
  });

  it("writes English for an unsupported or absent locale", async () => {
    const { formatMoment } = await loadIn("UTC");

    expect(formatMoment(MOMENT, "fr")).toBe("Oct 6, 2026, 3:30 PM");
    expect(formatMoment(MOMENT)).toBe("Oct 6, 2026, 3:30 PM");
  });

  it("reads the moment in the time zone of the viewer", async () => {
    const { formatMoment } = await loadIn("Asia/Jakarta");

    expect(formatMoment(MOMENT, "en")).toBe("Oct 6, 2026, 10:30 PM");
    expect(formatMoment(MOMENT, "id")).toBe("6 Okt 2026, 22.30");
  });
});

describe("formatPublished", () => {
  it("writes the day, the short month, and the year in English", () => {
    expect(formatPublished("2026-10-06")).toBe("6 Oct, 2026");
    expect(formatPublished("2026-09-21")).toBe("21 Sep, 2026");
    expect(formatPublished("2025-01-01")).toBe("1 Jan, 2025");
  });

  // The test pins the zone of the viewer itself: a host that already runs in
  // UTC, such as the CI runner, would name the right day without the guard.
  // Midnight UTC is the evening before west of UTC, so the first day of a month
  // would read as the last day of the one before.
  for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    it(`names the same day for a viewer at ${zone}`, async () => {
      const { formatPublished: publishedInZone } = await loadIn(zone);

      expect(publishedInZone("2026-10-01")).toBe("1 Oct, 2026");
      expect(publishedInZone("2026-10-06")).toBe("6 Oct, 2026");
      expect(publishedInZone("2027-01-01")).toBe("1 Jan, 2027");
    });
  }
});
