import { researchMaxSources } from "@repo/backend/client/nina/research";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import { isPublicHttpUrlSyntax } from "@repo/backend/confect/nina/research/url";
import { Schema, Struct } from "effect";
export const webSearchMaxQueries = 4;
/** Reject excess sources before provider work instead of silently dropping any. */
export class ResearchSourceLimitError extends Schema.TaggedError<ResearchSourceLimitError>()(
  "ResearchSourceLimitError",
  { maximum: Schema.Literal(researchMaxSources), received: Schema.Int }
) {}
const urlInputSchema = Schema.NonEmptyString.pipe(
  Schema.check(
    Schema.makeFilter(isPublicHttpUrlSyntax, {
      message: "Expected a public http(s) URL.",
    })
  )
).annotate({
  description: createPrompt({
    taskContext: `
      The public http(s) URL to scrape.
    `,
  }),
});
export const ScrapeInputSchema = Schema.Struct({
  urlToCrawl: urlInputSchema,
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: createPrompt({
      taskContext: `
        Get content from one selected public URL.
      `,
    }),
  });
const ScrapeOutputSchema = Schema.Struct({
  data: Schema.Struct({
    content: Schema.String,
    description: Schema.optional(Schema.String),
    favicon: Schema.optional(Schema.String),
    title: Schema.optional(Schema.String),
    url: Schema.String,
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
  error: Schema.optional(Schema.String),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const WebSearchInputSchema = Schema.Struct({
  queries: Schema.Array(Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))))
    .pipe(
      Schema.mutable,
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(webSearchMaxQueries))
    )
    .annotate({
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
  sourcePreference: Schema.Literals(["primary", "any"]).annotate({
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
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
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
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const WebSearchOutputSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  sources: Schema.Array(WebSearchSourceSchema).pipe(Schema.mutable),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: createPrompt({
      taskContext: `
        Web search results with source content and citation labels.
      `,
    }),
  });
const ResearchCitationSchema = Schema.Struct({
  title: Schema.String.annotate({
    description: createPrompt({
      taskContext: `
        Concise citation label shown to the user.
      `,
    }),
  }),
  url: Schema.String.annotate({
    description: createPrompt({
      taskContext: `
        Source URL copied exactly from the provided evidence.
      `,
    }),
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const ResearchFindingSchema = Schema.Struct({
  text: Schema.NonEmptyString.annotate({
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
    .pipe(Schema.mutable)
    .annotate({
      description: createPrompt({
        taskContext: `
          Sources that directly support this finding.
        `,
      }),
    }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/**
 * What synthesis returns. The schema asks only for shape: the citation filter
 * decides which findings count, so a stray URL or an unsupported finding drops
 * that finding instead of rejecting the whole answer.
 */
export const ResearchOutputSchema = Schema.Struct({
  findings: Schema.Array(ResearchFindingSchema)
    .pipe(Schema.mutable)
    .annotate({
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
    .annotate({
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
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const webSearchInputSchema = createEffectSchema(WebSearchInputSchema);
export const researchOutputSchema = createEffectSchema(ResearchOutputSchema);
/**
 * Search provider failed before returning usable source data. It keeps the
 * HTTP status the provider answered with and never its message, which may
 * repeat the query.
 */
export class ResearchSearchError extends Schema.TaggedError<ResearchSearchError>()(
  "ResearchSearchError",
  {
    message: Schema.String,
    status: Schema.optional(Schema.Finite),
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
/**
 * Language model generation failed during one research phase. It carries
 * routing facts only: `rejected` says the model answered with something other
 * than the asked object, and `gateway` classifies a failed call. Neither holds
 * the task, the sources, or the answer.
 */
export class ResearchGenerationError extends Schema.TaggedError<ResearchGenerationError>()(
  "ResearchGenerationError",
  {
    gateway: Schema.optional(GatewayFailure),
    message: Schema.String,
    phase: Schema.Literals(["search", "synthesis"]),
    rejected: Schema.Boolean,
  }
) {}
export type ScrapeOutput = typeof ScrapeOutputSchema.Type;
export type ResearchOutput = typeof ResearchOutputSchema.Type;
export type WebSearchInput = typeof WebSearchInputSchema.Type;
export type WebSearchOutput = typeof WebSearchOutputSchema.Type;
