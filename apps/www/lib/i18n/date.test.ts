// @vitest-environment node
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Duration } from "effect";
import { formatAge, formatMoment, formatPublished } from "@/lib/i18n/date";

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const MOMENT = Date.UTC(2026, 9, 6, 15, 30, 0);

/** The moment that lies `age` before `NOW`. */
const before = (age: Duration.Duration) => NOW - Duration.toMillis(age);

/**
 * Each age with its words in English, Indonesian, and German. The ages that
 * date-fns wrote as `3 days ago`, `3 hari yang lalu`, and `vor 3 Tagen` keep
 * those words. For the other ages date-fns added "about", "over", "almost", or
 * "less than", which `Intl.RelativeTimeFormat` does not have, and wrote "less
 * than a minute ago" where the platform says "now".
 */
const AGES = [
  { age: Duration.zero, de: "jetzt", en: "now", id: "sekarang" },
  { age: Duration.seconds(29), de: "jetzt", en: "now", id: "sekarang" },
  {
    age: Duration.seconds(30),
    de: "vor 1 Minute",
    en: "1 minute ago",
    id: "1 menit yang lalu",
  },
  {
    age: Duration.seconds(89),
    de: "vor 1 Minute",
    en: "1 minute ago",
    id: "1 menit yang lalu",
  },
  {
    age: Duration.seconds(90),
    de: "vor 2 Minuten",
    en: "2 minutes ago",
    id: "2 menit yang lalu",
  },
  {
    age: Duration.minutes(44),
    de: "vor 44 Minuten",
    en: "44 minutes ago",
    id: "44 menit yang lalu",
  },
  {
    age: Duration.minutes(45),
    de: "vor 1 Stunde",
    en: "1 hour ago",
    id: "1 jam yang lalu",
  },
  {
    age: Duration.hours(5),
    de: "vor 5 Stunden",
    en: "5 hours ago",
    id: "5 jam yang lalu",
  },
  {
    age: Duration.hours(23),
    de: "vor 23 Stunden",
    en: "23 hours ago",
    id: "23 jam yang lalu",
  },
  {
    age: Duration.hours(24),
    de: "vor 1 Tag",
    en: "1 day ago",
    id: "1 hari yang lalu",
  },
  {
    age: Duration.days(3),
    de: "vor 3 Tagen",
    en: "3 days ago",
    id: "3 hari yang lalu",
  },
  {
    age: Duration.days(29),
    de: "vor 29 Tagen",
    en: "29 days ago",
    id: "29 hari yang lalu",
  },
  {
    age: Duration.days(30),
    de: "vor 1 Monat",
    en: "1 month ago",
    id: "1 bulan yang lalu",
  },
  {
    age: Duration.days(200),
    de: "vor 7 Monaten",
    en: "7 months ago",
    id: "7 bulan yang lalu",
  },
  {
    age: Duration.days(364),
    de: "vor 12 Monaten",
    en: "12 months ago",
    id: "12 bulan yang lalu",
  },
  {
    age: Duration.days(365),
    de: "vor 1 Jahr",
    en: "1 year ago",
    id: "1 tahun yang lalu",
  },
  {
    age: Duration.days(800),
    de: "vor 2 Jahren",
    en: "2 years ago",
    id: "2 tahun yang lalu",
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("formatAge", () => {
  for (const { age, de, en, id } of AGES) {
    it(`says an age of ${Duration.format(age)} in each language`, () => {
      const timestamp = before(age);

      expect(formatAge(timestamp, "en", NOW)).toBe(en);
      expect(formatAge(timestamp, "id", NOW)).toBe(id);
      expect(formatAge(timestamp, "de", NOW)).toBe(de);
    });
  }

  it("reads a moment after now as now", () => {
    expect(
      formatAge(NOW + Duration.toMillis(Duration.minutes(5)), "en", NOW)
    ).toBe("now");
    expect(
      formatAge(NOW + Duration.toMillis(Duration.days(2)), "de", NOW)
    ).toBe("jetzt");
  });

  it("writes English for an unsupported or absent locale", () => {
    const timestamp = before(Duration.days(3));

    expect(formatAge(timestamp, "fr", NOW)).toBe("3 days ago");
    expect(formatAge(timestamp, null, NOW)).toBe("3 days ago");
    expect(formatAge(timestamp, undefined, NOW)).toBe("3 days ago");
  });

  it("counts from the current time when no moment is named", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    expect(formatAge(before(Duration.hours(5)), "en")).toBe("5 hours ago");
  });
});

describe("formatMoment", () => {
  it("writes the moment in the order and words of each language", () => {
    vi.stubEnv("TZ", "UTC");

    expect(formatMoment(MOMENT, "en")).toBe("Oct 6, 2026, 3:30 PM");
    expect(formatMoment(MOMENT, "id")).toBe("6 Okt 2026, 15.30");
    expect(formatMoment(MOMENT, "de")).toBe("6. Okt. 2026, 15:30");
  });

  it("writes English for an unsupported or absent locale", () => {
    vi.stubEnv("TZ", "UTC");

    expect(formatMoment(MOMENT, "fr")).toBe("Oct 6, 2026, 3:30 PM");
    expect(formatMoment(MOMENT)).toBe("Oct 6, 2026, 3:30 PM");
  });

  it("reads the moment in the time zone of the viewer", () => {
    vi.stubEnv("TZ", "Asia/Jakarta");

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
  // would read as the last day of the one before. The month formatter is built
  // when the module loads, so each zone loads the module afresh.
  for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    it(`names the same day for a viewer at ${zone}`, async () => {
      vi.stubEnv("TZ", zone);
      vi.resetModules();
      const { formatPublished: publishedInZone } = await import(
        "@/lib/i18n/date"
      );

      expect(publishedInZone("2026-10-01")).toBe("1 Oct, 2026");
      expect(publishedInZone("2026-10-06")).toBe("6 Oct, 2026");
      expect(publishedInZone("2027-01-01")).toBe("1 Jan, 2027");
    });
  }
});
