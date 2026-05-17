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

/** Converts Gemini Google Search grounding into Nakafa's web-search UI data. */
export function createGroundingWebSearchData({
  providerMetadata,
  sources,
}: {
  providerMetadata: unknown;
  sources: unknown;
}) {
  const groundingMetadata = getGroundingMetadata(providerMetadata);
  const searchQueries = groundingMetadata
    ? getGroundingSearchQueries(groundingMetadata)
    : [];
  const groundedSources = getGroundedSources({ groundingMetadata, sources });

  if (groundedSources.length === 0 && searchQueries.length === 0) {
    return;
  }

  return {
    provider: "google",
    queries: searchQueries,
    sources: groundedSources,
    status: "done",
  } satisfies DataPart["web-search"];
}

/** Checks whether grounding data can be shown as one query-scoped search row. */
export function hasSingleGroundingQuery(data: DataPart["web-search"]) {
  return data.queries.length === 1;
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

      return [createWebSearchSource(source.url, source.title)];
    });

    if (resultSources.length > 0) {
      return resultSources;
    }
  }

  return (groundingMetadata?.groundingChunks ?? []).flatMap((chunk) => {
    if (!chunk.web) {
      return [];
    }

    return [createWebSearchSource(chunk.web.uri, chunk.web.title)];
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

  if (URL.canParse(url)) {
    return new URL(url).hostname.replace("www.", "");
  }

  return url;
}
