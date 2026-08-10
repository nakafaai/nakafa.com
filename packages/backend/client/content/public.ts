import "server-only";

import {
  decodePublicContentRuntimeRequest,
  decodePublicContentRuntimeResponse,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeRequest,
  type PublicContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import {
  type ContentHttpTarget,
  createContentContractError,
  createContentEndpoint,
  encodeContentRequest,
  postContentRequest,
  readContentResponse,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/transport";
import { PUBLIC_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";

/** Server-owned connection values for the private content runtime endpoint. */
export type ContentRuntimeTarget = ContentHttpTarget;

/** Public route identity without its module-owned delivery discriminator. */
export interface PublicContentRuntimeInput {
  readonly locale: PublicContentRuntimeRequest["locale"];
  readonly publicPath: string;
}

type PublicContentVerification =
  | { readonly kind: "frozen" }
  | { readonly kind: "live"; readonly rendererManifest: unknown };

/** Selects the renderer authority required by one public read capability. */
function getVerificationRenderer(
  verification: PublicContentVerification,
  response: PublicContentRuntimeResponse
) {
  if (verification.kind === "live") {
    return verification.rendererManifest;
  }
  if (response.kind === "found") {
    return response.rendererManifest;
  }
  return;
}

/** Reads one public response without trusting its advertised size or shape. */
const readPublicRuntimeResponse = Effect.fn(
  "NakafaContent.readPublicRuntimeResponse"
)(function* (response: Response, endpoint: string) {
  const input = yield* readContentResponse(
    response,
    endpoint,
    MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
  );
  const decoded = yield* decodePublicContentRuntimeResponse(input).pipe(
    Effect.mapError(() => createContentContractError(response))
  );
  yield* validateContentRuntimeStatus(decoded, response.status);
  return decoded;
});

/** Reads and authenticates one public artifact under an explicit renderer policy. */
const readPublicContentProgram = Effect.fn(
  "NakafaContent.readPublicContentProgram"
)(function* (
  target: ContentRuntimeTarget,
  input: PublicContentRuntimeInput,
  verification: PublicContentVerification
) {
  const request = yield* decodePublicContentRuntimeRequest({
    delivery: "public",
    ...input,
  }).pipe(
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
  );
  const source = yield* encodeContentRequest(
    request,
    MAX_PUBLIC_RUNTIME_REQUEST_BYTES
  );
  const endpoint = yield* createContentEndpoint(
    target.siteUrl,
    PUBLIC_CONTENT_RUNTIME_PATH
  );
  const response = yield* postContentRequest({ endpoint, source, target });
  const decoded = yield* readPublicRuntimeResponse(response, endpoint);
  const rendererManifest = getVerificationRenderer(verification, decoded);
  const verified = yield* verifyContentRuntimeExchange({
    rendererManifest,
    request,
    response: decoded,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
    Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
  );
  if (verified.kind === "missing") {
    return yield* new ContentRuntimeMissingError({ request });
  }
  if (verified.kind === "failure") {
    return yield* new ContentRuntimeFailureError({
      code: verified.code,
      status: response.status,
    });
  }
  return verified;
});

/** Reads signed public evidence without claiming compatibility for execution. */
export const readPublicContentEvidence = Effect.fn(
  "NakafaContent.readPublicContentEvidence"
)(function* (target: ContentRuntimeTarget, input: PublicContentRuntimeInput) {
  return yield* readPublicContentProgram(target, input, { kind: "frozen" });
});

/** Reads one public artifact verified against the caller's live renderer. */
export const readPublicContent = Effect.fn("NakafaContent.readPublicContent")(
  function* (
    target: ContentRuntimeTarget,
    input: PublicContentRuntimeInput,
    rendererManifest: unknown
  ) {
    return yield* readPublicContentProgram(target, input, {
      kind: "live",
      rendererManifest,
    });
  }
);
