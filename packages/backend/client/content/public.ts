import {
  decodePublicContentRuntimeRequest,
  PublicContentRuntimeFoundSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import type { PublicContentRuntimeInputSchema } from "@repo/backend/content/batch";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect, Schema } from "effect";

/** Public route identity without its module-owned delivery discriminator. */
type PublicContentRuntimeInput = typeof PublicContentRuntimeInputSchema.Type;

/**
 * Authenticates one public response that a reader composed from its parts: the
 * signed release document and renderer manifest of the release, the signed
 * artifact read by its hash, and the route's projection, projection hash and
 * source path. Each part keeps its own signature, so the response proves what the
 * envelope of one query did, and the live renderer proves it can execute the
 * artifact.
 */
export const verifyPublicContentFound = Effect.fn(
  "NakafaContent.verifyPublicContentFound"
)(function* (
  input: PublicContentRuntimeInput,
  value: unknown,
  rendererManifest: unknown
) {
  const request = yield* decodePublicContentRuntimeRequest({
    delivery: "public",
    ...input,
  }).pipe(
    Effect.mapError(
      () =>
        new ContentTransportError({
          reason: "request",
        })
    )
  );
  const response = yield* Schema.decodeUnknownEffect(
    PublicContentRuntimeFoundSchema
  )(value).pipe(
    Effect.mapError(
      () =>
        new ContentTransportError({
          reason: "response-contract",
        })
    )
  );
  yield* verifyContentRuntimeExchange({
    rendererManifest,
    request,
    response,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
    Effect.mapError(
      (cause) =>
        new ContentRuntimeVerificationError({
          cause,
        })
    )
  );
  return response;
});
