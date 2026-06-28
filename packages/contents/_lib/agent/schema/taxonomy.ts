import { NakafaAgentSectionSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Schema } from "effect";

const UrlStringSchema = Schema.String.pipe(
  Schema.filter((value) => URL.canParse(value), {
    message: () => "Expected a valid URL.",
  })
);

const NakafaAgentTaxonomyOptionSchema = Schema.Struct({
  id: Schema.String.annotations({
    description: "Canonical route/schema identifier.",
  }),
  label: Schema.String.annotations({
    description: "Localized display label.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({
    description: "Supported taxonomy value with a localized label.",
  });

const CountByLocaleSchema = Schema.Struct({
  count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()).annotations({
    description: "Indexed content count.",
  }),
  locale: LocaleSchema.annotations({
    description: "Locale for this count.",
  }),
}).pipe(Schema.mutable);

/** Runtime schema for taxonomy input. */
export const NakafaAgentTaxonomyOptionsSchema = Schema.Struct({
  locale: Schema.optionalWith(LocaleSchema, {
    default: () => routing.defaultLocale,
  }).annotations({
    description: "Locale used for localized labels and content counts.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa taxonomy options." });

/** Runtime schema for taxonomy output. */
export const NakafaAgentTaxonomySchema = Schema.Struct({
  articles: Schema.Struct({
    categories: Schema.Array(Schema.String)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported article categories." }),
  })
    .pipe(Schema.mutable)
    .annotations({ description: "Article taxonomy." }),
  content_counts: Schema.Array(CountByLocaleSchema)
    .pipe(Schema.mutable)
    .annotations({ description: "Indexed content counts by locale." }),
  default_locale: LocaleSchema.annotations({
    description: "Default Nakafa locale.",
  }),
  endpoints: Schema.Struct({
    direct: UrlStringSchema.annotations({
      description: "Direct MCP endpoint.",
    }),
    recommended: UrlStringSchema.annotations({
      description: "Recommended MCP endpoint.",
    }),
    root_note: Schema.String.annotations({
      description: "Root URL connection guidance.",
    }),
  })
    .pipe(Schema.mutable)
    .annotations({ description: "MCP endpoint guidance." }),
  exercises: Schema.Struct({
    categories: Schema.Array(NakafaAgentTaxonomyOptionSchema)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported exercise categories." }),
    materials: Schema.Array(NakafaAgentTaxonomyOptionSchema)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported exercise materials." }),
    types: Schema.Array(NakafaAgentTaxonomyOptionSchema)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported exercise types." }),
  })
    .pipe(Schema.mutable)
    .annotations({ description: "Exercise taxonomy." }),
  locale: LocaleSchema.annotations({
    description: "Locale used for this taxonomy response.",
  }),
  locales: Schema.Array(LocaleSchema)
    .pipe(Schema.mutable)
    .annotations({ description: "Supported content locales." }),
  quran: Schema.Struct({
    surah_count: Schema.Number.pipe(
      Schema.int(),
      Schema.positive()
    ).annotations({
      description: "Indexed Quran surah count.",
    }),
  })
    .pipe(Schema.mutable)
    .annotations({ description: "Quran taxonomy." }),
  sections: Schema.Array(NakafaAgentSectionSchema)
    .pipe(Schema.mutable)
    .annotations({ description: "Supported top-level content sections." }),
  subject: Schema.Struct({
    categories: Schema.Array(Schema.String)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported subject categories." }),
    grades: Schema.Array(Schema.String)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported grade segments." }),
    materials: Schema.Array(Schema.String)
      .pipe(Schema.mutable)
      .annotations({ description: "Supported material lessons." }),
  })
    .pipe(Schema.mutable)
    .annotations({ description: "Subject taxonomy." }),
  tools: Schema.Array(Schema.String)
    .pipe(Schema.mutable)
    .annotations({ description: "Public MCP tools exposed by Nakafa." }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa public content taxonomy." });

export type NakafaAgentTaxonomyOptions = Schema.Schema.Type<
  typeof NakafaAgentTaxonomyOptionsSchema
>;
export type NakafaAgentTaxonomy = Schema.Schema.Type<
  typeof NakafaAgentTaxonomySchema
>;
