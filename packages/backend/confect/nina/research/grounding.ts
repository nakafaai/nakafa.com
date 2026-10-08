import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import { normalizeResearchCitationUrl } from "@repo/backend/confect/nina/research/citations";
import { Array as Arr, pipe, Result, Schema, Struct } from "effect";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const GroundingWebChunkSchema = Schema.Struct({
  web: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      uri: Schema.String,
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const GroundingMetadataSchema = Schema.Struct({
  groundingChunks: Schema.optional(
    Schema.NullOr(Schema.Array(GroundingWebChunkSchema).pipe(Schema.mutable))
  ),
  webSearchQueries: Schema.optional(
    Schema.NullOr(Schema.Array(Schema.String).pipe(Schema.mutable))
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const GroundingProviderSchema = Schema.Struct({
  groundingMetadata: Schema.optional(Schema.NullOr(GroundingMetadataSchema)),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const ProviderMetadataSchema = Schema.Struct({
  google: Schema.optional(GroundingProviderSchema),
  vertex: Schema.optional(GroundingProviderSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const SourceSchema = Schema.Struct({
  sourceType: Schema.String,
  title: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Converts source-backed Gemini Google Search grounding into web-search UI data. */
export function createGroundingWebSearchData({
  providerMetadata,
  sources,
}: {
  providerMetadata: unknown;
  sources: unknown;
}) {
  const groundingMetadata = getGroundingMetadata(providerMetadata);
  // A source shared by multiple queries owns one evidence identity and chip.
  const groundedSources = Arr.dedupeWith(
    getGroundedSources({
      ...(groundingMetadata === undefined ? {} : { groundingMetadata }),
      sources,
    }),
    (left, right) => left.url === right.url
  );
  if (!Arr.isArrayNonEmpty(groundedSources)) {
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
/**
 * Converts sanitized AI SDK Google grounding sources into synthesis evidence.
 *
 * References:
 * - https://ai-sdk.dev/docs/ai-sdk-core/generating-text#sources
 * - https://ai-sdk.dev/providers/ai-sdk-providers/google#google-search
 */
export function createGroundingEvidence(
  data: NonNullable<ReturnType<typeof createGroundingWebSearchData>>
) {
  return Arr.join(
    [
      "# Google Search Grounding Sources",
      ...formatGroundingQueries(data.queries),
      ...Arr.map(data.sources, formatGroundingSource),
    ],
    "\n"
  );
}
/** Reads Gemini grounding metadata from either Vercel Gateway provider shape. */
function getGroundingMetadata(providerMetadata: unknown) {
  const decoded = Schema.decodeUnknownResult(ProviderMetadataSchema)(
    providerMetadata
  );
  if (Result.isFailure(decoded)) {
    return;
  }
  return (
    decoded.success.vertex?.groundingMetadata ??
    decoded.success.google?.groundingMetadata ??
    undefined
  );
}
/** Prefers AI SDK source parts, then falls back to provider grounding chunks. */
function getGroundedSources({
  groundingMetadata,
  sources,
}: {
  groundingMetadata?: typeof GroundingMetadataSchema.Type;
  sources: unknown;
}) {
  const decoded = Schema.decodeUnknownResult(Schema.Array(SourceSchema))(
    sources
  );
  if (Result.isSuccess(decoded)) {
    const resultSources = Arr.flatMap(decoded.success, (source) => {
      if (source.sourceType !== "url" || !source.url) {
        return [];
      }
      return createGroundedSource(source.url, source.title);
    });
    if (resultSources.length > 0) {
      return resultSources;
    }
  }
  return Arr.flatMap(groundingMetadata?.groundingChunks ?? [], (chunk) => {
    if (!chunk.web) {
      return [];
    }
    return createGroundedSource(chunk.web.uri, chunk.web.title);
  });
}
/** Normalizes Google Search queries so the UI shows the actual searched term. */
function getGroundingSearchQueries(
  groundingMetadata: typeof GroundingMetadataSchema.Type
) {
  return Arr.dedupe(
    pipe(
      groundingMetadata.webSearchQueries ?? [],
      Arr.map((item) => item.trim().replace(/^"+|"+$/g, "")),
      Arr.filter(Boolean)
    )
  );
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
/** Creates a direct source entry that can be shown as retrieved web evidence. */
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
/** Formats provider search queries as compact model-readable evidence. */
function formatGroundingQueries(queries: string[]) {
  if (queries.length === 0) {
    return [];
  }
  return [
    `Queries: ${pipe(
      queries,
      Arr.map((query) => encodeJson(query)),
      Arr.join(", ")
    )}`,
  ];
}
/** Formats one grounded source for the research synthesis evidence block. */
function formatGroundingSource(
  source: DataPart["web-search"]["sources"][number]
) {
  return Arr.join([`- ${source.title}`, `  URL: ${source.url}`], "\n");
}
