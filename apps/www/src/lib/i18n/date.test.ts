// @vitest-environment node
import { afterEach, describe, expect, it } from "@effect/vitest";
import { formatPublished } from "@/lib/i18n/date";

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
