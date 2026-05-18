import { normalizeResearchCitationUrl } from "@repo/ai/agents/research/citations";
import type { DataPart } from "@repo/ai/schema/data";
import { Either, Schema } from "effect";

const GroundingWebChunkSchema = Schema.Struct({
  web: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      uri: Schema.String,
    }).pipe(Schema.mutable)
  ),
}).pipe(Schema.mutable);

const GroundingMetadataSchema = Schema.Struct({
  groundingChunks: Schema.optional(
    Schema.NullOr(Schema.Array(GroundingWebChunkSchema).pipe(Schema.mutable))
  ),
  webSearchQueries: Schema.optional(
    Schema.NullOr(Schema.Array(Schema.String).pipe(Schema.mutable))
  ),
}).pipe(Schema.mutable);

const GroundingProviderSchema = Schema.Struct({
  groundingMetadata: Schema.optional(Schema.NullOr(GroundingMetadataSchema)),
}).pipe(Schema.mutable);

const ProviderMetadataSchema = Schema.Struct({
  google: Schema.optional(GroundingProviderSchema),
  vertex: Schema.optional(GroundingProviderSchema),
}).pipe(Schema.mutable);

const SourceSchema = Schema.Struct({
  sourceType: Schema.String,
  title: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
}).pipe(Schema.mutable);

/** Converts source-backed Gemini Google Search grounding into web-search UI data. */
export function createGroundingWebSearchData({
  providerMetadata,
  sources,
}: {
  providerMetadata: unknown;
  sources: unknown;
}) {
  const groundingMetadata = getGroundingMetadata(providerMetadata);
  const groundedSources = getGroundedSources({ groundingMetadata, sources });

  if (groundedSources.length === 0) {
    return;
  }

  const searchQueries = groundingMetadata
    ? getGroundingSearchQueries(groundingMetadata)
    : [];

  return {
    provider: "google",
    queries: searchQueries,
    sources: groundedSources,
    status: "done",
  } satisfies DataPart["web-search"];
}

/** Checks whether source-backed grounding can be shown as one query-scoped row. */
export function hasSingleGroundingQuery(data: DataPart["web-search"]) {
  return data.queries.length === 1;
}

/**
 * Converts sanitized AI SDK Google grounding sources into synthesis evidence.
 *
 * References:
 * - https://ai-sdk.dev/docs/ai-sdk-core/generating-text#sources
 * - https://ai-sdk.dev/providers/ai-sdk-providers/google#google-search
 */
export function createGroundingEvidence(data: DataPart["web-search"]) {
  if (data.sources.length === 0) {
    return;
  }

  return [
    "# Google Search Grounding Sources",
    ...formatGroundingQueries(data.queries),
    ...data.sources.map(formatGroundingSource),
  ].join("\n");
}

/** Reads Gemini grounding metadata from either Vercel Gateway provider shape. */
function getGroundingMetadata(providerMetadata: unknown) {
  const decoded = Schema.decodeUnknownEither(ProviderMetadataSchema)(
    providerMetadata
  );

  if (Either.isLeft(decoded)) {
    return;
  }

  return (
    decoded.right.vertex?.groundingMetadata ??
    decoded.right.google?.groundingMetadata ??
    undefined
  );
}

/** Prefers AI SDK source parts, then falls back to provider grounding chunks. */
function getGroundedSources({
  groundingMetadata,
  sources,
}: {
  groundingMetadata?: Schema.Schema.Type<typeof GroundingMetadataSchema>;
  sources: unknown;
}) {
  const decoded = Schema.decodeUnknownEither(Schema.Array(SourceSchema))(
    sources
  );

  if (Either.isRight(decoded)) {
    const resultSources = decoded.right.flatMap((source) => {
      if (source.sourceType !== "url" || !source.url) {
        return [];
      }

      return createGroundedSource(source.url, source.title);
    });

    if (resultSources.length > 0) {
      return resultSources;
    }
  }

  return (groundingMetadata?.groundingChunks ?? []).flatMap((chunk) => {
    if (!chunk.web) {
      return [];
    }

    return createGroundedSource(chunk.web.uri, chunk.web.title);
  });
}

/** Normalizes Google Search queries so the UI shows the actual searched term. */
function getGroundingSearchQueries(
  groundingMetadata: Schema.Schema.Type<typeof GroundingMetadataSchema>
) {
  return [
    ...new Set(
      (groundingMetadata.webSearchQueries ?? [])
        .map((item) => item.trim().replace(/^"+|"+$/g, ""))
        .filter(Boolean)
    ),
  ];
}

/** Builds the data shape consumed by Nakafa's existing web-search tool UI. */
function createGroundedSource(url: string, title?: string) {
  if (isGoogleGroundingRedirectUrl(url)) {
    return [];
  }

  const normalized = normalizeResearchCitationUrl(url);

  if (!normalized) {
    return [];
  }

  return [createWebSearchSource(normalized, title)];
}

/** Rejects provider redirect artifacts that are not source-owned URLs. */
function isGoogleGroundingRedirectUrl(url: string) {
  if (!URL.canParse(url)) {
    return false;
  }

  const parsed = new URL(url);

  return (
    parsed.hostname === "vertexaisearch.cloud.google.com" ||
    parsed.pathname.includes("grounding-api-redirect")
  );
}

function createWebSearchSource(url: string, title?: string) {
  const sourceTitle = getSourceTitle(url, title);

  return {
    citation: `[${sourceTitle}](${url})`,
    content: "",
    description: "",
    title: sourceTitle,
    url,
  };
}

/** Uses provider titles first and falls back to a readable hostname or raw URI. */
function getSourceTitle(url: string, title?: string) {
  const cleanTitle = title?.trim();

  if (cleanTitle) {
    return cleanTitle;
  }

  return new URL(url).hostname.replace("www.", "");
}

function formatGroundingQueries(queries: string[]) {
  if (queries.length === 0) {
    return [];
  }

  return [
    `Queries: ${queries.map((query) => JSON.stringify(query)).join(", ")}`,
  ];
}

function formatGroundingSource(
  source: DataPart["web-search"]["sources"][number]
) {
  return [`- ${source.title}`, `  URL: ${source.url}`].join("\n");
}
