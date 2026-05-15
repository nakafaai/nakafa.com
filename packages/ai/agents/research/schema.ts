import { isPublicHttpUrlSyntax } from "@repo/ai/agents/research/url";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { Schema } from "effect";

export const webSearchMaxQueries = 4;

const urlInputSchema = Schema.NonEmptyString.pipe(
  Schema.filter(isPublicHttpUrlSyntax, {
    message: () => "Expected a public http(s) URL.",
  })
).annotations({
  description: "The URL to scrape, including http:// or https://.",
});

export const ScrapeInputSchema = Schema.Struct({
  urlToCrawl: urlInputSchema,
})
  .pipe(Schema.mutable)
  .annotations({ description: "Get the content of a URL." });

export const ScrapeOutputSchema = Schema.Struct({
  data: Schema.Struct({
    content: Schema.String,
    description: Schema.optional(Schema.String),
    favicon: Schema.optional(Schema.String),
    title: Schema.optional(Schema.String),
    url: Schema.String,
  }).pipe(Schema.mutable),
  error: Schema.optional(Schema.String),
}).pipe(Schema.mutable);

export const WebSearchInputSchema = Schema.Struct({
  queries: Schema.Array(Schema.Trim.pipe(Schema.minLength(1)))
    .pipe(
      Schema.minItems(1),
      Schema.maxItems(webSearchMaxQueries),
      Schema.mutable
    )
    .annotations({
      description:
        "One or more search-engine queries. Preserve exact named entities, domains, products, APIs, libraries, institutions, and dates from the research task. Omit answer-formatting instructions such as summary length, tone, output language, and citation style.",
    }),
})
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Search the web for up-to-date information using optimized query strings.",
  });

export const WebSearchSourceSchema = Schema.Struct({
  citation: Schema.String,
  content: Schema.String,
  description: Schema.String,
  title: Schema.String,
  url: Schema.String,
}).pipe(Schema.mutable);

export const WebSearchOutputSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  sources: Schema.Array(WebSearchSourceSchema).pipe(Schema.mutable),
})
  .pipe(Schema.mutable)
  .annotations({
    description:
      "The output schema for web search results. Use the citation field for inline citations.",
  });

export const ResearchCitationSchema = Schema.Struct({
  title: Schema.NonEmptyString.annotations({
    description: "Concise citation label shown to the user.",
  }),
  url: urlInputSchema.annotations({
    description: "Canonical source URL for the cited evidence.",
  }),
}).pipe(Schema.mutable);

export const ResearchFindingSchema = Schema.Struct({
  text: Schema.NonEmptyString.annotations({
    description:
      "One concise source-backed finding. Do not include markdown links, numeric citation markers, or bibliography text here.",
  }),
  citations: Schema.Array(ResearchCitationSchema)
    .pipe(Schema.minItems(1), Schema.mutable)
    .annotations({
      description: "Sources that directly support this finding.",
    }),
}).pipe(Schema.mutable);

export const ResearchOutputSchema = Schema.Struct({
  findings: Schema.Array(ResearchFindingSchema)
    .pipe(Schema.minItems(1), Schema.mutable)
    .annotations({
      description:
        "Source-backed findings. Keep each finding scoped to the cited sources.",
    }),
  limitations: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description:
        "Evidence gaps or caveats. Use an empty array when there are none.",
    }),
}).pipe(Schema.mutable);

export const scrapeInputSchema = createEffectSchema(ScrapeInputSchema);
export const webSearchInputSchema = createEffectSchema(WebSearchInputSchema);
export const researchOutputSchema = createEffectSchema(ResearchOutputSchema);

/** Search provider failed before returning usable source data. */
export class ResearchSearchError extends Schema.TaggedError<ResearchSearchError>()(
  "ResearchSearchError",
  {
    message: Schema.String,
  }
) {}

/** Scrape provider failed before returning usable page content. */
export class ResearchScrapeError extends Schema.TaggedError<ResearchScrapeError>()(
  "ResearchScrapeError",
  {
    message: Schema.String,
  }
) {}

/** Scrape URL was rejected before any server-side fetch. */
export class ResearchUnsafeUrlError extends Schema.TaggedError<ResearchUnsafeUrlError>()(
  "ResearchUnsafeUrlError",
  {
    message: Schema.String,
  }
) {}

/** Language model generation failed during one research phase. */
export class ResearchGenerationError extends Schema.TaggedError<ResearchGenerationError>()(
  "ResearchGenerationError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
    phase: Schema.Literal("evidence", "synthesis"),
    text: Schema.optional(Schema.String),
  }
) {}

export type ScrapeInput = Schema.Schema.Type<typeof ScrapeInputSchema>;
export type ScrapeOutput = Schema.Schema.Type<typeof ScrapeOutputSchema>;
export type ResearchOutput = Schema.Schema.Type<typeof ResearchOutputSchema>;
export type WebSearchInput = Schema.Schema.Type<typeof WebSearchInputSchema>;
export type WebSearchOutput = Schema.Schema.Type<typeof WebSearchOutputSchema>;
