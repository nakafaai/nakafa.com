import "server-only";

import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import { verifyPublicContentResponse } from "@repo/backend/client/content/public";
import {
  type ContentHttpTarget,
  createContentContractError,
  createContentEndpoint,
  encodeContentRequest,
  readContentResponse,
  requestContentResponse,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/transport";
import { MATERIAL_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import {
  MAX_MATERIAL_RUNTIME_RESPONSE_BYTES,
  type MaterialRuntimeFound,
  MaterialRuntimeResponseSchema,
} from "@repo/backend/content/material";
import { Effect, Schema } from "effect";

/** Exact public material identity without its fixed delivery class. */
export interface MaterialRuntimeInput {
  readonly appLocale: MaterialRuntimeFound["runtime"]["projection"]["appLocale"];
  readonly publicPath: string;
}

/** Reads one cohesive response without trusting its advertised shape or size. */
const readMaterialResponse = Effect.fn("NakafaContent.readMaterialResponse")(
  function* (response: Response, endpoint: string) {
    const input = yield* readContentResponse(
      response,
      endpoint,
      MAX_MATERIAL_RUNTIME_RESPONSE_BYTES
    );
    const decoded = yield* Schema.decodeUnknownEffect(
      MaterialRuntimeResponseSchema
    )(input, { onExcessProperty: "error" }).pipe(
      Effect.mapError(() => createContentContractError(response))
    );
    yield* validateContentRuntimeStatus(decoded, response.status);
    return decoded;
  }
);

/** Reads and verifies one material shell and body selected in one transaction. */
export const readMaterialContent = Effect.fn(
  "NakafaContent.readMaterialContent"
)(function* (
  target: ContentHttpTarget,
  input: MaterialRuntimeInput,
  rendererManifest: unknown
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
    MATERIAL_CONTENT_RUNTIME_PATH
  );
  const { response, value: decoded } = yield* requestContentResponse(
    { endpoint, source, target },
    readMaterialResponse
  );
  if (decoded.kind === "missing") {
    return yield* new ContentRuntimeMissingError({ request });
  }
  if (decoded.kind === "failure") {
    return yield* new ContentRuntimeFailureError({
      code: decoded.code,
      status: response.status,
    });
  }
  const runtime = yield* verifyPublicContentResponse(
    request,
    decoded.runtime,
    { kind: "live", rendererManifest },
    response.status
  );
  return { model: decoded.model, runtime };
});
