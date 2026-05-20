import { isPublicHttpUrlSyntax } from "@repo/ai/agents/research/url";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { createPrompt } from "@repo/ai/prompt/utils";
import { Schema } from "effect";

export const webSearchMaxQueries = 4;

const urlInputSchema = Schema.NonEmptyString.pipe(
  Schema.filter(isPublicHttpUrlSyntax, {
    message: () => "Expected a public http(s) URL.",
  })
).annotations({
  description: createPrompt({
    taskContext: `
      The public http(s) URL to scrape.
    `,
  }),
});

export const ScrapeInputSchema = Schema.Struct({
  urlToCrawl: urlInputSchema,
})
  .pipe(Schema.mutable)
  .annotations({
    description: createPrompt({
      taskContext: `
        Get content from one selected public URL.
      `,
    }),
  });

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
      description: createPrompt({
        taskContext: `
        One or more search-engine queries.

        Preserve task-relevant user-provided strings for:
        - named entities, domains, products, APIs, and libraries.
        - features, versions, institutions, and dates.
        - URLs, source constraints, and document titles.

        Omit answer-formatting instructions:
        - summary length.
        - tone.
        - output language.
        - citation style.
      `,
      }),
    }),
  sourcePreference: Schema.Literal("primary", "any").annotations({
    description: createPrompt({
      taskContext: `
      Choose primary when the task requires direct evidence from:
      - a source owner.
      - a first-party publisher.
      - a maintainer or vendor.
      - a standards body.
      - paper authors.

      Choose any when broader credible sources are acceptable.
    `,
    }),
  }),
})
  .pipe(Schema.mutable)
  .annotations({
    description: createPrompt({
      taskContext: `
        Search the web for up-to-date information using optimized query strings.
      `,
    }),
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
    description: createPrompt({
      taskContext: `
        Web search results with source content and citation labels.
      `,
    }),
  });

export const ResearchCitationSchema = Schema.Struct({
  title: Schema.NonEmptyString.annotations({
    description: createPrompt({
      taskContext: `
        Concise citation label shown to the user.
      `,
    }),
  }),
  url: urlInputSchema.annotations({
    description: createPrompt({
      taskContext: `
        Canonical source URL for the cited evidence.
      `,
    }),
  }),
}).pipe(Schema.mutable);

export const ResearchFindingSchema = Schema.Struct({
  text: Schema.NonEmptyString.annotations({
    description: createPrompt({
      taskContext: `
      One concise source-backed finding.

      Do not include:
      - markdown links.
      - numeric citation markers.
      - bibliography text.
    `,
    }),
  }),
  citations: Schema.Array(ResearchCitationSchema)
    .pipe(Schema.minItems(1), Schema.mutable)
    .annotations({
      description: createPrompt({
        taskContext: `
          Sources that directly support this finding.
        `,
      }),
    }),
}).pipe(Schema.mutable);

export const ResearchOutputSchema = Schema.Struct({
  findings: Schema.Array(ResearchFindingSchema)
    .pipe(Schema.mutable)
    .annotations({
      description: createPrompt({
        taskContext: `
        Source-backed findings.

        Keep each finding scoped to the cited sources.
        Use an empty array when direct citation evidence is unavailable.
      `,
      }),
    }),
  limitations: Schema.Array(Schema.NonEmptyString)
    .pipe(Schema.mutable)
    .annotations({
      description: createPrompt({
        taskContext: `
        Process limitations in the user's locale.
        Use an empty array when there are none.

        Describe only what this retrieval attempt could not establish.
        Do not use found or not-found wording.
        Do not make absence claims.
        Do not mention a database, corpus, or search index.
      `,
      }),
    }),
  noEvidenceAnswer: Schema.NonEmptyString.annotations({
    description: createPrompt({
      taskContext: `
      A brief user-facing process limitation in the user's locale.
      Use it when no source-backed finding can be returned.

      Generate a natural one-sentence answer in the user's locale.
      Communicate only these ideas:
      - the retrieval attempt did not establish verification from direct sources.
      - a direct channel the user can check next.
      - do not copy or translate this schema description verbatim.

      Use first-person process wording.
      Do not describe the world as lacking official information.
      Prefer verification wording over search-result wording.
      Do not say information was found or not found.
      Do not say evidence, proof, or information is unavailable.
      Do not mention a database, corpus, or search index.

      Do not include unsupported:
      - factual claims.
      - absence claims.
      - source names, URLs, or dates.
      - rules or recommendations.
    `,
    }),
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
