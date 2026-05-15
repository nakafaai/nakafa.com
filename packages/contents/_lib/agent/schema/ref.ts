import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Schema } from "effect";

const UrlStringSchema = Schema.String.pipe(
  Schema.filter((value) => URL.canParse(value), {
    message: () => "Expected a valid URL.",
  })
);

/** Runtime schema for public Nakafa sections exposed to agents. */
export const NakafaAgentSectionSchema = Schema.Literal(
  ...NAKAFA_AGENT_SECTIONS
).annotations({
  description:
    'Public Nakafa content section: "subject" lessons and study materials, "articles" editorial/news content, "exercises" practice questions, or "quran" Quran references.',
});

/** Runtime schema for a canonical content reference used across agent tools. */
export const NakafaAgentContentRefSchema = Schema.Struct({
  content_id: Schema.String.annotations({
    description: "Stable content identifier returned by Nakafa MCP search.",
  }),
  locale: LocaleSchema.annotations({
    description: "Locale of the referenced content.",
  }),
  markdown_url: UrlStringSchema.annotations({
    description: "Canonical markdown URL for focused agent retrieval.",
  }),
  route: Schema.String.annotations({
    description: "Locale-free route under the Nakafa content tree.",
  }),
  section: NakafaAgentSectionSchema.annotations({
    description: "Top-level Nakafa content section.",
  }),
  url: UrlStringSchema.annotations({
    description: "Canonical public Nakafa URL for citation.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Canonical Nakafa agent content reference." });

/** Runtime schema for one searchable Nakafa content summary. */
export const NakafaAgentContentSummarySchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      description: Schema.String.annotations({
        description: "Short content description for search results.",
      }),
      title: Schema.String.annotations({
        description: "Human-readable content title.",
      }),
    })
  ),
  Schema.mutable
).annotations({ description: "Searchable Nakafa content summary." });

export type NakafaAgentSection = Schema.Schema.Type<
  typeof NakafaAgentSectionSchema
>;
export type NakafaAgentContentRef = Schema.Schema.Type<
  typeof NakafaAgentContentRefSchema
>;
export type NakafaAgentContentSummary = Schema.Schema.Type<
  typeof NakafaAgentContentSummarySchema
>;
