import { Schema } from "effect";

const groundingWebChunkSchema = Schema.Struct({
  web: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      uri: Schema.String,
    })
  ),
});

const groundingMetadataSchema = Schema.Struct({
  groundingChunks: Schema.optional(
    Schema.NullOr(Schema.Array(groundingWebChunkSchema))
  ),
  webSearchQueries: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
});

const groundingProviderSchema = Schema.Struct({
  groundingMetadata: Schema.optional(Schema.NullOr(groundingMetadataSchema)),
});

/** AI SDK provider metadata persisted because the app consumes it. */
export const providerMetadataSchema = Schema.Struct({
  google: Schema.optional(groundingProviderSchema),
  vertex: Schema.optional(groundingProviderSchema),
});
