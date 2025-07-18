import { z } from "zod";

export const VerseSchema = z.object({
  number: z.object({
    inSurah: z.number(),
    inQuran: z.number(),
  }),
  meta: z.object({
    juz: z.number(),
    page: z.number(),
    manzil: z.number(),
    ruku: z.number(),
    hizbQuarter: z.number(),
    sajda: z.object({
      recommended: z.boolean(),
      obligatory: z.boolean(),
    }),
  }),
  text: z.object({
    arab: z.string(),
    transliteration: z.object({
      en: z.string(),
    }),
  }),
  translation: z.object({
    en: z.string(),
    id: z.string(),
  }),
  audio: z.object({
    primary: z.string(),
    secondary: z.array(z.string()),
  }),
  tafsir: z.object({
    id: z.object({
      short: z.string(),
      long: z.string(),
    }),
  }),
});
export type Verse = z.infer<typeof VerseSchema>;

export const SurahSchema = z.object({
  number: z.number(),
  sequence: z.number(),
  numberOfVerses: z.number(),
  name: z.object({
    short: z.string(),
    long: z.string(),
    transliteration: z.object({
      en: z.string(),
      id: z.string(),
    }),
    translation: z.object({
      en: z.string(),
      id: z.string(),
    }),
  }),
  revelation: z.object({
    arab: z.string(),
    en: z.string(),
    id: z.string(),
  }),
  preBismillah: VerseSchema.pick({
    text: true,
    translation: true,
    audio: true,
  }).optional(),
  verses: z.array(VerseSchema),
});
export type Surah = z.infer<typeof SurahSchema>;
