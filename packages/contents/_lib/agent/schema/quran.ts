import { NakafaAgentContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import * as z from "zod";

/** Runtime schema for Quran reference input. */
export const NakafaAgentQuranReferenceOptionsSchema = z
  .object({
    from_verse: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("First verse number to include."),
    include_tafsir: z
      .boolean()
      .default(false)
      .describe("Whether to include concise Indonesian tafsir text."),
    locale: LocaleSchema.default(routing.defaultLocale).describe(
      "Translation locale."
    ),
    surah: z.number().int().min(1).max(114).describe("Surah number."),
    to_verse: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Last verse number to include; defaults to from_verse."),
  })
  .describe("Nakafa Quran reference options.");

/** Runtime schema for one Quran verse returned to agents. */
export const NakafaAgentQuranVerseSchema = z
  .object({
    arabic: z.string().describe("Arabic Quran verse text."),
    number: z.number().int().min(1).describe("Verse number inside the surah."),
    tafsir: z.string().optional().describe("Optional concise tafsir text."),
    translation: z.string().describe("Selected translation text."),
    transliteration: z.string().describe("Latin transliteration text."),
  })
  .describe("Nakafa Quran verse reference.");

/** Runtime schema for Quran reference output. */
export const NakafaAgentQuranReferenceSchema =
  NakafaAgentContentRefSchema.extend({
    name: z.string().describe("Localized surah display name."),
    revelation: z.string().describe("Localized revelation place."),
    translation: z.string().describe("Localized surah name translation."),
    verses: z
      .array(NakafaAgentQuranVerseSchema)
      .min(1)
      .describe("Bounded Quran verses."),
  }).describe("Nakafa Quran reference result.");

export type NakafaAgentQuranReferenceOptions = z.input<
  typeof NakafaAgentQuranReferenceOptionsSchema
>;
export type NakafaAgentQuranReference = z.infer<
  typeof NakafaAgentQuranReferenceSchema
>;
