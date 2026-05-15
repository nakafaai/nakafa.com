import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { Schema } from "effect";

export const webSearchMaxQueries = 4;

const urlInputSchema = Schema.NonEmptyString.pipe(
  Schema.filter((value) => URL.canParse(value), {
    message: () => "Expected a valid URL.",
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

export const scrapeInputSchema = createEffectSchema(ScrapeInputSchema);
export const webSearchInputSchema = createEffectSchema(WebSearchInputSchema);

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

export type ScrapeInput = Schema.Schema.Type<typeof ScrapeInputSchema>;
export type ScrapeOutput = Schema.Schema.Type<typeof ScrapeOutputSchema>;
export type WebSearchInput = Schema.Schema.Type<typeof WebSearchInputSchema>;
export type WebSearchOutput = Schema.Schema.Type<typeof WebSearchOutputSchema>;
