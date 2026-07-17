import {
  getSurah,
  getSurahName,
  readQuranMetadata,
} from "@repo/contents/_lib/quran";
import { SurahNotFoundError } from "@repo/contents/_shared/error";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("@repo/contents/quran/source");
  vi.resetModules();
});

describe("Quran metadata", () => {
  it("decodes the complete canonical corpus for every locale", async () => {
    const metadata = await Effect.runPromise(readQuranMetadata());

    expect(metadata).toHaveLength(114);
    expect(metadata[0]?.number).toBe(1);
    expect(metadata.at(-1)?.number).toBe(114);

    for (const surah of metadata) {
      expect(Object.keys(surah.name.translation).sort()).toEqual(
        [...locales].sort()
      );
      expect(Object.keys(surah.name.transliteration).sort()).toEqual(
        [...locales].sort()
      );
      expect(surah.numberOfVerses).toBeGreaterThan(0);
    }
  });

  it("fails with a typed error when the imported corpus is invalid", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/quran/source", () => ({
      quran: [{ number: "invalid" }],
    }));

    const invalidQuran = await import("@repo/contents/_lib/quran");
    const isolatedEffect = await import("effect");
    const error = await isolatedEffect.Effect.runPromise(
      isolatedEffect.Effect.flip(invalidQuran.readQuranMetadata())
    );

    expect(error).toMatchObject({
      _tag: "QuranCorpusError",
      message: "Unable to decode the Quran metadata corpus.",
    });
  });
});

describe("surah queries", () => {
  it("returns the requested surah with its verses", async () => {
    const surah = await Effect.runPromise(getSurah(1));

    expect(surah).toMatchObject({
      name: { short: "الفاتحة" },
      number: 1,
      numberOfVerses: 7,
    });
    expect(surah.verses).toHaveLength(7);
  });

  it.each([0, 1.5])("rejects invalid surah number %s", async (id) => {
    const error = await Effect.runPromise(Effect.flip(getSurah(id)));

    expect(error).toBeInstanceOf(SurahNotFoundError);
    expect(error.surahNumber).toBe(id);
  });

  it("fails when a valid positive number is absent", async () => {
    const error = await Effect.runPromise(Effect.flip(getSurah(115)));

    expect(error).toBeInstanceOf(SurahNotFoundError);
    expect(error.message).toBe("Surah was not found.");
  });
});

describe("getSurahName", () => {
  it("returns the exact locale transliteration", async () => {
    const surah = await Effect.runPromise(getSurah(1));

    expect(getSurahName({ locale: "en", name: surah.name })).toBe("Al-Faatiha");
    expect(getSurahName({ locale: "id", name: surah.name })).toBe("Al-Fatihah");
  });
});
