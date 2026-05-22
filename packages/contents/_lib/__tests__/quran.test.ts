import {
  getAllSurah,
  getSurah,
  getSurahName,
  getVerseBySurah,
  getVersesByJuz,
  validateSurahWithoutVerses,
} from "@repo/contents/_lib/quran";
import {
  SurahNotFoundError,
  VerseNotFoundError,
} from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("getSurah", () => {
  describe("Happy Paths", () => {
    it("should return surah 1 (Al-Fatihah)", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      expect(surahValue.number).toBe(1);
      expect(surahValue.name.short).toBe("الفاتحة");
      expect(surahValue.numberOfVerses).toBe(7);
    });

    it("should return surah 114 (An-Nas)", async () => {
      const surahValue = await Effect.runPromise(getSurah(114));
      expect(surahValue.number).toBe(114);
      expect(surahValue.numberOfVerses).toBe(6);
    });

    it("should return surah with all expected properties", async () => {
      const surahValue = await Effect.runPromise(getSurah(2));
      expect(surahValue.number).toBe(2);
      expect(surahValue.sequence).toBeDefined();
      expect(surahValue.numberOfVerses).toBeDefined();
      expect(surahValue.name).toBeDefined();
      expect(surahValue.name.short).toBeDefined();
      expect(surahValue.name.long).toBeDefined();
      expect(surahValue.name.transliteration).toBeDefined();
      expect(surahValue.name.translation).toBeDefined();
      expect(surahValue.revelation).toBeDefined();
      expect(surahValue.verses).toBeDefined();
      expect(Array.isArray(surahValue.verses)).toBe(true);
    });

    it("should return surah with verses array", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      expect(surahValue.verses).toBeDefined();
      expect(surahValue.verses.length).toBeGreaterThan(0);
      expect(surahValue.verses[0].number.inSurah).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle boundary value 1 (first surah)", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      expect(surahValue.number).toBe(1);
    });

    it("should handle boundary value 114 (last surah)", async () => {
      const surahValue = await Effect.runPromise(getSurah(114));
      expect(surahValue.number).toBe(114);
    });

    it("should handle surah in middle of range (57)", async () => {
      const surahValue = await Effect.runPromise(getSurah(57));
      expect(surahValue.number).toBe(57);
    });
  });

  describe("Error Paths", () => {
    it("should fail for surah id 0 (below minimum)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getSurah(0), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for surah id -1 (negative)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getSurah(-1), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for surah id 115 (above maximum)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getSurah(115), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for surah id 999 (far above maximum)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getSurah(999), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for floating point number 1.5", async () => {
      const result = await Effect.runPromise(
        Effect.match(getSurah(1.5), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for NaN", async () => {
      const result = await Effect.runPromise(
        Effect.match(getSurah(Number.NaN), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });
  });
});

describe("getAllSurah", () => {
  describe("Happy Paths", () => {
    it("should return all 114 surahs", () => {
      const surahs = getAllSurah();
      expect(surahs).toHaveLength(114);
    });

    it("should return surahs without verses property", () => {
      const surahs = getAllSurah();
      expect(surahs[0]).toBeDefined();
      expect("verses" in surahs[0]).toBe(false);
      expect(surahs[0].number).toBeDefined();
      expect(surahs[0].name).toBeDefined();
    });

    it("should return surahs with all required properties except verses", () => {
      const surahs = getAllSurah();
      const firstSurah = surahs[0];
      expect(firstSurah).toBeDefined();
      expect(firstSurah.number).toBe(1);
      expect(firstSurah.sequence).toBeDefined();
      expect(firstSurah.numberOfVerses).toBeDefined();
      expect(firstSurah.name).toBeDefined();
      expect(firstSurah.name.short).toBeDefined();
      expect(firstSurah.name.long).toBeDefined();
      expect(firstSurah.name.transliteration).toBeDefined();
      expect(firstSurah.name.translation).toBeDefined();
      expect(firstSurah.revelation).toBeDefined();
    });

    it("should return surahs in correct order", () => {
      const surahs = getAllSurah();
      expect(surahs[0].number).toBe(1);
      expect(surahs[1].number).toBe(2);
      expect(surahs[113].number).toBe(114);
    });

    it("should have surah names in multiple locales", () => {
      const surahs = getAllSurah();
      const firstSurah = surahs[0];
      expect(firstSurah.name.transliteration.en).toBe("Al-Faatiha");
      expect(firstSurah.name.transliteration.id).toBe("Al-Fatihah");
      expect(firstSurah.name.translation.en).toBe("The Opening");
      expect(firstSurah.name.translation.id).toBe("Pembukaan");
    });
  });

  describe("Data Integrity", () => {
    it("should have valid surah numbers (1-114)", () => {
      const surahs = getAllSurah();
      for (const [index, surah] of surahs.entries()) {
        expect(surah.number).toBe(index + 1);
        expect(surah.number).toBeGreaterThanOrEqual(1);
        expect(surah.number).toBeLessThanOrEqual(114);
      }
    });

    it("should have valid number of verses for each surah", () => {
      const surahs = getAllSurah();
      for (const surah of surahs) {
        expect(surah.numberOfVerses).toBeDefined();
        expect(surah.numberOfVerses).toBeGreaterThan(0);
      }
    });

    it("should have revelation type for each surah", () => {
      const surahs = getAllSurah();
      for (const surah of surahs) {
        expect(surah.revelation).toBeDefined();
        expect(surah.revelation.arab).toBeDefined();
        expect(surah.revelation.en).toBeDefined();
        expect(surah.revelation.id).toBeDefined();
      }
    });
  });
});

describe("getVersesByJuz", () => {
  describe("Happy Paths", () => {
    it("should return verses for Juz 1", () => {
      const verses = getVersesByJuz(1);
      expect(verses).toBeDefined();
      expect(verses.length).toBeGreaterThan(0);
      for (const verse of verses) {
        expect(verse.meta.juz).toBe(1);
      }
    });

    it("should return verses for Juz 30", () => {
      const verses = getVersesByJuz(30);
      expect(verses).toBeDefined();
      expect(verses.length).toBeGreaterThan(0);
      for (const verse of verses) {
        expect(verse.meta.juz).toBe(30);
      }
    });

    it("should return verses for Juz in middle of range (15)", () => {
      const verses = getVersesByJuz(15);
      expect(verses).toBeDefined();
      expect(verses.length).toBeGreaterThan(0);
      for (const verse of verses) {
        expect(verse.meta.juz).toBe(15);
      }
    });

    it("should return verses with all expected properties", () => {
      const verses = getVersesByJuz(1);
      expect(verses.length).toBeGreaterThan(0);
      const verse = verses[0];
      expect(verse.number).toBeDefined();
      expect(verse.number.inQuran).toBeDefined();
      expect(verse.number.inSurah).toBeDefined();
      expect(verse.meta).toBeDefined();
      expect(verse.text).toBeDefined();
      expect(verse.translation).toBeDefined();
      expect(verse.audio).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle boundary value 1 (first juz)", () => {
      const verses = getVersesByJuz(1);
      expect(verses.length).toBeGreaterThan(0);
    });

    it("should handle boundary value 30 (last juz)", () => {
      const verses = getVersesByJuz(30);
      expect(verses.length).toBeGreaterThan(0);
    });

    it("should return verses from multiple surahs for a juz", () => {
      const verses = getVersesByJuz(1);
      const surahNumbers = new Set(verses.map((v) => v.number.inSurah));
      expect(surahNumbers.size).toBeGreaterThan(1);
    });
  });

  describe("Error Paths", () => {
    it("should return empty array for juz 0 (below minimum)", () => {
      const verses = getVersesByJuz(0);
      expect(verses).toEqual([]);
    });

    it("should return empty array for juz -1 (negative)", () => {
      const verses = getVersesByJuz(-1);
      expect(verses).toEqual([]);
    });

    it("should return empty array for juz 31 (above maximum)", () => {
      const verses = getVersesByJuz(31);
      expect(verses).toEqual([]);
    });

    it("should return empty array for juz 999 (far above maximum)", () => {
      const verses = getVersesByJuz(999);
      expect(verses).toEqual([]);
    });

    it("should return empty array for floating point number 1.5", () => {
      const verses = getVersesByJuz(1.5);
      expect(verses).toEqual([]);
    });

    it("should return empty array for NaN", () => {
      const verses = getVersesByJuz(Number.NaN);
      expect(verses).toEqual([]);
    });
  });
});

describe("getVerseBySurah", () => {
  describe("Happy Paths", () => {
    it("should return first verse of surah 1 (Al-Fatihah)", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 1, verse: 1 })
      );
      expect(verseValue.number.inSurah).toBe(1);
      expect(verseValue.number.inQuran).toBe(1);
    });

    it("should return last verse of surah 1 (Al-Fatihah)", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 1, verse: 7 })
      );
      expect(verseValue.number.inSurah).toBe(7);
    });

    it("should return verse from middle of surah", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 2, verse: 100 })
      );
      expect(verseValue.number.inSurah).toBe(100);
    });

    it("should return verse with all expected properties", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 1, verse: 1 })
      );
      expect(verseValue.number.inQuran).toBeDefined();
      expect(verseValue.number.inSurah).toBeDefined();
      expect(verseValue.meta).toBeDefined();
      expect(verseValue.meta.juz).toBeDefined();
      expect(verseValue.meta.page).toBeDefined();
      expect(verseValue.text).toBeDefined();
      expect(verseValue.text.arab).toBeDefined();
      expect(verseValue.text.transliteration.en).toBeDefined();
      expect(verseValue.translation).toBeDefined();
      expect(verseValue.translation.en).toBeDefined();
      expect(verseValue.translation.id).toBeDefined();
      expect(verseValue.audio).toBeDefined();
      expect(verseValue.audio.primary).toBeDefined();
      expect(verseValue.audio.secondary).toBeDefined();
    });

    it("should return verse with translations in both en and id", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 1, verse: 1 })
      );
      expect(verseValue.translation.en).toBeDefined();
      expect(verseValue.translation.id).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle first verse of first surah", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 1, verse: 1 })
      );
      expect(verseValue.number.inQuran).toBe(1);
    });

    it("should handle verse with sajda information", async () => {
      const verseValue = await Effect.runPromise(
        getVerseBySurah({ surah: 1, verse: 1 })
      );
      expect(verseValue.meta.sajda).toBeDefined();
      expect(verseValue.meta.sajda.recommended).toBeDefined();
      expect(verseValue.meta.sajda.obligatory).toBeDefined();
    });
  });

  describe("Error Paths", () => {
    it("should fail for invalid surah id (0)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 0, verse: 1 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for surah id 115 (above maximum)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 115, verse: 1 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for invalid verse number (0)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 1, verse: 0 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(VerseNotFoundError);
    });

    it("should fail for negative verse number", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 1, verse: -1 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(VerseNotFoundError);
    });

    it("should fail for verse number 287 (above maximum)", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 2, verse: 287 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(VerseNotFoundError);
    });

    it("should fail for verse number beyond surah's actual verses", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 1, verse: 100 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(VerseNotFoundError);
    });

    it("should fail for floating point surah number", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 1.5, verse: 1 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for floating point verse number", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 1, verse: 1.5 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(VerseNotFoundError);
    });

    it("should fail for NaN surah", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: Number.NaN, verse: 1 }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(SurahNotFoundError);
    });

    it("should fail for NaN verse", async () => {
      const result = await Effect.runPromise(
        Effect.match(getVerseBySurah({ surah: 1, verse: Number.NaN }), {
          onSuccess: () => null,
          onFailure: (error) => error,
        })
      );
      expect(result).toBeInstanceOf(VerseNotFoundError);
    });
  });
});

describe("validateSurahWithoutVerses", () => {
  describe("Happy Paths", () => {
    it("should return valid surah without verses", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const result = validateSurahWithoutVerses(surahValue);
      expect(Option.isSome(result)).toBe(true);
      const resultValue = Option.getOrThrow(result);
      expect(resultValue.number).toBe(1);
      expect("verses" in resultValue).toBe(false);
    });

    it("should preserve all properties except verses", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const result = validateSurahWithoutVerses(surahValue);
      expect(Option.isSome(result)).toBe(true);
      const resultValue = Option.getOrThrow(result);
      expect(resultValue.number).toBeDefined();
      expect(resultValue.sequence).toBeDefined();
      expect(resultValue.numberOfVerses).toBeDefined();
      expect(resultValue.name).toBeDefined();
      expect(resultValue.revelation).toBeDefined();
    });
  });

  describe("Error Paths", () => {
    it("should return Option.none for invalid data", () => {
      const result = validateSurahWithoutVerses({ invalid: "data" });
      expect(Option.isNone(result)).toBe(true);
    });

    it("should return Option.none for null input", () => {
      const result = validateSurahWithoutVerses(null);
      expect(Option.isNone(result)).toBe(true);
    });

    it("should return Option.none for undefined input", () => {
      const result = validateSurahWithoutVerses(undefined);
      expect(Option.isNone(result)).toBe(true);
    });

    it("should return Option.none for array input", () => {
      const result = validateSurahWithoutVerses([]);
      expect(Option.isNone(result)).toBe(true);
    });

    it("should return Option.none for partial surah data", () => {
      const result = validateSurahWithoutVerses({ number: 1 });
      expect(Option.isNone(result)).toBe(true);
    });

    it("should return Option.none for surah with missing required fields", () => {
      const result = validateSurahWithoutVerses({
        number: 1,
        sequence: 5,
      });
      expect(Option.isNone(result)).toBe(true);
    });
  });
});

describe("getSurahName", () => {
  describe("Happy Paths", () => {
    it("should return transliteration name for en locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const name = getSurahName({ locale: "en", name: surahValue.name });
      expect(name).toBe("Al-Faatiha");
    });

    it("should return transliteration name for id locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const name = getSurahName({ locale: "id", name: surahValue.name });
      expect(name).toBe("Al-Fatihah");
    });

    it("should return translation name for en locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const name = getSurahName({ locale: "en", name: surahValue.name });
      expect(name).toBe("Al-Faatiha");
    });

    it("should return translation name for id locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const name = getSurahName({ locale: "id", name: surahValue.name });
      expect(name).toBe("Al-Fatihah");
    });

    it("should return long Arabic name as fallback", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const name = getSurahName({
        locale: "invalid",
        name: surahValue.name,
      });
      expect(name).toContain("ٱلْفَاتِحَة");
    });

    it("should return long Arabic name for unknown locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const name = getSurahName({
        locale: "unknown-locale",
        name: surahValue.name,
      });
      expect(name).toBe(surahValue.name.long);
    });

    it("should return transliteration when available but not translation", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const customName = {
        ...surahValue.name,
        transliteration: {
          en: "Test Name",
          id: "Nama Tes",
        },
        translation: {
          en: "Test Translation",
          id: "Terjemahan Tes",
        },
      };
      const name = getSurahName({
        locale: "custom-locale",
        name: customName,
      });
      expect(name).toBe(customName.long);
    });

    it("should return translation when transliteration missing for locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const customName = {
        ...surahValue.name,
        transliteration: {
          en: "Test Name",
          id: "Nama Tes",
        },
        translation: {
          en: "Test Translation",
          id: "Terjemahan Tes",
          custom: "Custom Translation",
        },
      };
      const name = getSurahName({
        locale: "custom",
        name: customName,
      });
      expect(name).toBe("Custom Translation");
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle surah 2 (Al-Baqarah) with en locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(2));
      const name = getSurahName({ locale: "en", name: surahValue.name });
      expect(name).toBeDefined();
      expect(typeof name).toBe("string");
    });

    it("should handle surah 114 (An-Nas) with id locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(114));
      const name = getSurahName({ locale: "id", name: surahValue.name });
      expect(name).toBeDefined();
      expect(typeof name).toBe("string");
    });

    it("should return non-empty string for valid locale", async () => {
      const surahValue = await Effect.runPromise(getSurah(1));
      const nameEn = getSurahName({ locale: "en", name: surahValue.name });
      const nameId = getSurahName({ locale: "id", name: surahValue.name });
      expect(nameEn.length).toBeGreaterThan(0);
      expect(nameId.length).toBeGreaterThan(0);
    });
  });
});
