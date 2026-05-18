import { isPublicHttpUrlSyntax } from "@repo/ai/agents/research/url";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import dedent from "dedent";
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
      description: dedent(`
        One or more search-engine queries.

        Preserve exact wording for:
        - named entities, domains, products, APIs, and libraries.
        - features, versions, institutions, and dates.
        - URLs, source constraints, and document titles.

        Omit answer-formatting instructions:
        - summary length.
        - tone.
        - output language.
        - citation style.
      `),
    }),
  sourcePreference: Schema.Literal("primary", "any").annotations({
    description: dedent(`
      Choose primary when the task requires direct evidence from:
      - a source owner.
      - a first-party publisher.
      - a maintainer or vendor.
      - a standards body.
      - paper authors.

      Choose any when broader credible sources are acceptable.
    `),
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
    description: dedent(`
      One concise source-backed finding.

      Do not include:
      - markdown links.
      - numeric citation markers.
      - bibliography text.
    `),
  }),
  citations: Schema.Array(ResearchCitationSchema)
    .pipe(Schema.minItems(1), Schema.mutable)
    .annotations({
      description: "Sources that directly support this finding.",
    }),
}).pipe(Schema.mutable);

export const ResearchOutputSchema = Schema.Struct({
  findings: Schema.Array(ResearchFindingSchema)
    .pipe(Schema.mutable)
    .annotations({
      description: dedent(`
        Source-backed findings.

        Keep each finding scoped to the cited sources.
        Use an empty array when direct citation evidence is unavailable.
      `),
    }),
  limitations: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description:
        "Evidence gaps or caveats. Use an empty array when there are none.",
    }),
  noEvidenceAnswer: Schema.NonEmptyString.annotations({
    description: dedent(`
      A brief user-facing process limitation in the user's locale.
      Use it when no source-backed finding can be returned.

      Say only:
      - this run could not verify the request from retrieved direct source evidence.
      - what direct channel the user can check next.

      Do not include unsupported:
      - factual claims.
      - absence claims.
      - source names, URLs, or dates.
      - rules or recommendations.
    `),
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
