import { NakafaAgentSectionSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import * as z from "zod";

/** Runtime schema for taxonomy input. */
export const NakafaAgentTaxonomyOptionsSchema = z
  .object({
    locale: LocaleSchema.default(routing.defaultLocale).describe(
      "Locale used for localized labels and content counts."
    ),
  })
  .describe("Nakafa taxonomy options.");

/** Runtime schema for taxonomy output. */
export const NakafaAgentTaxonomySchema = z
  .object({
    articles: z
      .object({
        categories: z
          .array(z.string())
          .describe("Supported article categories."),
      })
      .describe("Article taxonomy."),
    content_counts: z
      .array(
        z.object({
          count: z.number().int().min(0).describe("Indexed content count."),
          locale: LocaleSchema.describe("Locale for this count."),
        })
      )
      .describe("Indexed content counts by locale."),
    default_locale: LocaleSchema.describe("Default Nakafa locale."),
    endpoints: z
      .object({
        direct: z.url().describe("Direct MCP endpoint."),
        recommended: z.url().describe("Recommended MCP endpoint."),
        root_note: z.string().describe("Root URL connection guidance."),
      })
      .describe("MCP endpoint guidance."),
    exercises: z
      .object({
        categories: z
          .array(z.string())
          .describe("Supported exercise categories."),
        materials: z
          .array(z.string())
          .describe("Supported exercise materials."),
        types: z.array(z.string()).describe("Supported exercise types."),
      })
      .describe("Exercise taxonomy."),
    locale: LocaleSchema.describe("Locale used for this taxonomy response."),
    locales: z.array(LocaleSchema).describe("Supported content locales."),
    quran: z
      .object({
        surah_count: z
          .number()
          .int()
          .min(1)
          .describe("Indexed Quran surah count."),
      })
      .describe("Quran taxonomy."),
    sections: z
      .array(NakafaAgentSectionSchema)
      .describe("Supported top-level content sections."),
    subject: z
      .object({
        categories: z
          .array(z.string())
          .describe("Supported subject categories."),
        grades: z.array(z.string()).describe("Supported grade segments."),
        materials: z.array(z.string()).describe("Supported subject materials."),
      })
      .describe("Subject taxonomy."),
    tools: z.array(z.string()).describe("Public MCP tools exposed by Nakafa."),
  })
  .describe("Nakafa public content taxonomy.");

export type NakafaAgentTaxonomyOptions = z.output<
  typeof NakafaAgentTaxonomyOptionsSchema
>;
export type NakafaAgentTaxonomy = z.infer<typeof NakafaAgentTaxonomySchema>;
