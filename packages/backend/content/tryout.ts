import {
  ContentLocaleSchema,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import { Effect, Schema } from "effect";

/** Maximum complete request accepted by the private try-out content route. */
export const MAX_TRYOUT_CONTENT_REQUEST_BYTES = 16 * 1024;

/** Maximum complete response returned by the private try-out content route. */
export const MAX_TRYOUT_CONTENT_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Maximum placements rendered by one frozen try-out section. */
export const MAX_TRYOUT_CONTENT_PLACEMENTS = 100;

const RouteKeySchema = Schema.NonEmptyTrimmedString;
const PlacementIdSchema = Schema.NonEmptyTrimmedString;

/** Stable route identity accepted by the authenticated content seam. */
export const TryoutContentRequestSchema = Schema.Struct({
  countryKey: RouteKeySchema,
  examKey: RouteKeySchema,
  locale: ContentLocaleSchema,
  sectionKey: RouteKeySchema,
  setKey: RouteKeySchema,
  trackKey: RouteKeySchema,
});
/** Stable route identity accepted by the authenticated content seam. */
export type TryoutContentRequest = typeof TryoutContentRequestSchema.Type;

/** One placement-bound question and optional terminal answer artifact. */
export const TryoutContentArtifactSchema = Schema.Struct({
  answerArtifact: Schema.optional(SignedContentArtifactSchema),
  placementId: PlacementIdSchema,
  questionArtifact: SignedContentArtifactSchema,
});
/** One placement-bound question and optional terminal answer artifact. */
export type TryoutContentArtifact = typeof TryoutContentArtifactSchema.Type;

/** Successful content response selected entirely by backend-owned state. */
export const TryoutContentFoundSchema = Schema.Struct({
  artifacts: Schema.Array(TryoutContentArtifactSchema).pipe(
    Schema.maxItems(MAX_TRYOUT_CONTENT_PLACEMENTS)
  ),
  kind: Schema.Literal("found"),
});
/** Successful content response selected entirely by backend-owned state. */
export type TryoutContentFound = typeof TryoutContentFoundSchema.Type;

/** Sanitized private-route failures safe to expose to the Nakafa server. */
export const TryoutContentFailureSchema = Schema.Struct({
  code: Schema.Literal(
    "TRYOUT_CONTENT_INTERNAL",
    "TRYOUT_CONTENT_INVALID",
    "TRYOUT_CONTENT_UNAUTHORIZED"
  ),
  kind: Schema.Literal("failure"),
});
/** Sanitized private-route failures safe to expose to the Nakafa server. */
export type TryoutContentFailure = typeof TryoutContentFailureSchema.Type;

/** Exact response vocabulary for private try-out content delivery. */
export const TryoutContentResponseSchema = Schema.Union(
  TryoutContentFoundSchema,
  TryoutContentFailureSchema,
  Schema.Struct({ kind: Schema.Literal("unavailable") })
);
/** Exact response vocabulary for private try-out content delivery. */
export type TryoutContentResponse = typeof TryoutContentResponseSchema.Type;

/** Decodes an unknown route identity without allowing excess properties. */
export const decodeTryoutContentRequest = Effect.fn(
  "NakafaContent.decodeTryoutContentRequest"
)((input: unknown) =>
  Schema.decodeUnknown(TryoutContentRequestSchema)(input, {
    onExcessProperty: "error",
  })
);

/** Decodes an unknown private response without allowing excess properties. */
export const decodeTryoutContentResponse = Effect.fn(
  "NakafaContent.decodeTryoutContentResponse"
)((input: unknown) =>
  Schema.decodeUnknown(TryoutContentResponseSchema)(input, {
    onExcessProperty: "error",
  })
);
