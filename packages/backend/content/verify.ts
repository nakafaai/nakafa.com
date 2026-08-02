import { ContentDeliveryClassSchema } from "@nakafa/aksara-contracts/delivery";
import { verifyContentRendererCompatibility } from "@nakafa/aksara-contracts/renderer/compatibility";
import {
  type ContentRuntimeFound,
  decodeContentRuntimeRequest,
  decodeContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { Effect, Option, Schema } from "effect";

const RuntimeFoundIdentitySchema = Schema.Struct({
  delivery: ContentDeliveryClassSchema,
  kind: Schema.Literal("found"),
});

/** A runtime response or live renderer does not match its trusted identity. */
export class ContentEnvelopeMismatchError extends Schema.TaggedError<ContentEnvelopeMismatchError>()(
  "ContentEnvelopeMismatchError",
  {
    reason: Schema.Literal(
      "activeManifestHash",
      "activeReleaseId",
      "artifactHash",
      "contentKey",
      "delivery",
      "locale",
      "projectionHash",
      "publicPath",
      "rendererManifest",
      "snapshotId",
      "sourcePath"
    ),
  }
) {}

/**
 * Verifies one signed runtime envelope without requiring a React registry.
 *
 * Raw Markdown consumers use the release-owned renderer snapshot. Executable
 * consumers must additionally call `verifyContentRenderer` with their live
 * physical registry before evaluating compiled code.
 */
export const verifyContentEnvelope = Effect.fn(
  "NakafaContent.verifyContentEnvelope"
)(function* ({
  request: requestInput,
  response: responseInput,
}: {
  readonly request: unknown;
  readonly response: unknown;
}) {
  const request = yield* decodeContentRuntimeRequest(requestInput);
  const identity = Schema.decodeUnknownOption(RuntimeFoundIdentitySchema)(
    responseInput
  );
  if (Option.isSome(identity) && identity.value.delivery !== request.delivery) {
    return yield* new ContentEnvelopeMismatchError({ reason: "delivery" });
  }
  const response = yield* decodeContentRuntimeResponse(responseInput);
  if (response.kind !== "found") {
    return response;
  }

  return yield* verifyContentRuntimeExchange({
    rendererManifest: response.rendererManifest,
    request,
    response,
  }).pipe(
    Effect.catchTag("ContentRuntimeMismatchError", (error) =>
      Effect.fail(new ContentEnvelopeMismatchError({ reason: error.reason }))
    )
  );
});

/** Requires the live app to route and support one verified signed artifact. */
export const verifyContentRenderer = Effect.fn(
  "NakafaContent.verifyContentRenderer"
)(function* ({
  found,
  rendererManifest,
}: {
  readonly found: ContentRuntimeFound;
  readonly rendererManifest: unknown;
}) {
  yield* verifyContentRendererCompatibility({
    payload: found.artifact.payload,
    rendererContractVersion: found.release.manifest.rendererContractVersion,
    rendererManifest,
  }).pipe(
    Effect.mapError(
      () =>
        new ContentEnvelopeMismatchError({
          reason: "rendererManifest",
        })
    )
  );

  return found;
});
