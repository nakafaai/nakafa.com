import { defineTable } from "convex/server";
import { v } from "convex/values";

const localizedTextValidator = v.object({
  en: v.string(),
  id: v.string(),
});

const quranTextValidator = v.object({
  arab: v.string(),
  transliteration: v.object({
    en: v.string(),
  }),
});

const quranAudioValidator = v.object({
  primary: v.string(),
  secondary: v.array(v.string()),
});

const preBismillahValidator = v.object({
  audio: quranAudioValidator,
  text: quranTextValidator,
  translation: localizedTextValidator,
});

const quranNameValidator = v.object({
  long: v.string(),
  short: v.string(),
  transliteration: localizedTextValidator,
  translation: localizedTextValidator,
});

const quranRevelationValidator = v.object({
  arab: v.string(),
  en: v.string(),
  id: v.string(),
});

const tables = {
  /** Quran surah metadata synced from the content authoring package. */
  quranSurahs: defineTable({
    contentHash: v.string(),
    name: quranNameValidator,
    number: v.number(),
    numberOfVerses: v.number(),
    preBismillah: v.optional(v.union(v.null(), preBismillahValidator)),
    revelation: quranRevelationValidator,
    sequence: v.number(),
    syncedAt: v.number(),
  }).index("by_number", ["number"]),

  /** Quran verse rows keyed for bounded surah and verse-range reads. */
  quranVerses: defineTable({
    audio: quranAudioValidator,
    contentHash: v.string(),
    hizbQuarter: v.number(),
    juz: v.number(),
    manzil: v.number(),
    page: v.number(),
    quranNumber: v.number(),
    ruku: v.number(),
    sajdaObligatory: v.boolean(),
    sajdaRecommended: v.boolean(),
    surahNumber: v.number(),
    syncedAt: v.number(),
    tafsir: v.object({
      id: v.object({
        short: v.string(),
      }),
    }),
    text: quranTextValidator,
    translation: localizedTextValidator,
    verseNumber: v.number(),
  })
    .index("by_surahNumber", ["surahNumber"])
    .index("by_surahNumber_and_verseNumber", ["surahNumber", "verseNumber"])
    .index("by_quranNumber", ["quranNumber"])
    .index("by_juz", ["juz"]),
};

export default tables;
