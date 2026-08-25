import { NakafaAgentSectionSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema, Struct } from "effect";

const UrlStringSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
const NakafaAgentTaxonomyOptionSchema = Schema.Struct({
  id: Schema.String.annotate({
    description: "Canonical route/schema identifier.",
  }),
  label: Schema.String.annotate({
    description: "Localized display label.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: "Supported taxonomy value with a localized label.",
  });
const CountByLocaleSchema = Schema.Struct({
  count: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ).annotate({
    description: "Indexed content count.",
  }),
  locale: LocaleSchema.annotate({
    description: "Locale for this count.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Runtime schema for taxonomy input. */
export const NakafaAgentTaxonomyOptionsSchema = Schema.Struct({
  locale: LocaleSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(routing.defaultLocale))
  ).annotate({
    default: routing.defaultLocale,
    description: "Locale used for localized labels and content counts.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa taxonomy options." });
const NakafaAgentTaxonomyFields = {
  articles: Schema.Struct({
    categories: Schema.Array(Schema.String)
      .pipe(Schema.mutable)
      .annotate({ description: "Supported article categories." }),
  })
    .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
    .annotate({ description: "Article taxonomy." }),
  content_counts: Schema.Array(CountByLocaleSchema)
    .pipe(Schema.mutable)
    .annotate({ description: "Indexed content counts by locale." }),
  default_locale: LocaleSchema.annotate({
    description: "Default Nakafa locale.",
  }),
  tryout: Schema.Struct({
    countries: Schema.Array(NakafaAgentTaxonomyOptionSchema)
      .pipe(Schema.mutable)
      .annotate({ description: "Supported try-out countries." }),
    exams: Schema.Array(NakafaAgentTaxonomyOptionSchema)
      .pipe(Schema.mutable)
      .annotate({ description: "Supported try-out exams." }),
  })
    .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
    .annotate({ description: "Try-out taxonomy." }),
  locale: LocaleSchema.annotate({
    description: "Locale used for this taxonomy response.",
  }),
  locales: Schema.Array(LocaleSchema)
    .pipe(Schema.mutable)
    .annotate({ description: "Supported content locales." }),
  quran: Schema.Struct({
    surah_count: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ).annotate({
      description: "Indexed Quran surah count.",
    }),
  })
    .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
    .annotate({ description: "Quran taxonomy." }),
  sections: Schema.Array(NakafaAgentSectionSchema)
    .pipe(Schema.mutable)
    .annotate({ description: "Supported top-level content sections." }),
  tools: Schema.Array(Schema.String)
    .pipe(Schema.mutable)
    .annotate({ description: "Public MCP tools exposed by Nakafa." }),
};
/** Runtime schema for the current REST and MCP taxonomy output. */
export const NakafaAgentTaxonomySchema = Schema.Struct({
  ...NakafaAgentTaxonomyFields,
  endpoints: Schema.Struct({
    mcp: UrlStringSchema.annotate({
      description: "Canonical Streamable HTTP MCP endpoint.",
    }),
  })
    .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
    .annotate({ description: "Canonical agent endpoints." }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa public content taxonomy." });
/** Runtime schema retained for the deployed SDK 1.30 taxonomy contract. */
export const NakafaAgentLegacyTaxonomySchema = Schema.Struct({
  ...NakafaAgentTaxonomyFields,
  endpoints: Schema.Struct({
    direct: UrlStringSchema.annotate({
      description: "Direct MCP application endpoint.",
    }),
    recommended: UrlStringSchema.annotate({
      description: "Existing same-origin MCP endpoint.",
    }),
    root_note: Schema.String.annotate({
      description: "MCP subdomain root guidance.",
    }),
  })
    .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
    .annotate({ description: "Legacy MCP endpoint guidance." }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa SDK 1.30 content taxonomy." });
export type NakafaAgentTaxonomyOptions = Schema.Schema.Type<
  typeof NakafaAgentTaxonomyOptionsSchema
>;
export type NakafaAgentTaxonomy = Schema.Schema.Type<
  typeof NakafaAgentTaxonomySchema
>;
export type NakafaAgentLegacyTaxonomy = Schema.Schema.Type<
  typeof NakafaAgentLegacyTaxonomySchema
>;
