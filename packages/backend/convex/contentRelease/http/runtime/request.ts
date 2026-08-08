import {
  type HttpBodyError,
  type HttpJsonBody,
  readJsonBody,
} from "@repo/backend/convex/contentRelease/http/body";
import { matchesHttpSecret } from "@repo/backend/convex/contentRelease/http/secret";
import {
  failureResult,
  type RuntimeHttpResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { Effect, Either } from "effect";

/** Authenticated bounded body or one response-safe rejection. */
export type RuntimeRequestResult =
  | { readonly body: HttpJsonBody; readonly kind: "accepted" }
  | { readonly kind: "rejected"; readonly result: RuntimeHttpResult };

/** Maps one shared bounded-body failure to its stable HTTP status. */
function bodyFailureResult(error: HttpBodyError) {
  if (error.reason === "size") {
    return failureResult("CONTENT_RUNTIME_INVALID", 413);
  }
  if (error.reason === "unsupported") {
    return failureResult("CONTENT_RUNTIME_INVALID", 415);
  }
  return failureResult("CONTENT_RUNTIME_INVALID", 400);
}

/** Authenticates before reading one complete bounded runtime request body. */
export const readRuntimeRequest = Effect.fn(
  "contentRelease.readRuntimeRequest"
)(function* (request: Request, secret: string, maxBytes: number) {
  const trustedServer = yield* matchesHttpSecret(
    request.headers.get("x-nakafa-content-token") ?? "",
    secret
  ).pipe(Effect.either);
  if (Either.isLeft(trustedServer)) {
    return {
      kind: "rejected",
      result: failureResult("CONTENT_RUNTIME_INTERNAL", 500),
    } satisfies RuntimeRequestResult;
  }
  if (!trustedServer.right) {
    return {
      kind: "rejected",
      result: failureResult("CONTENT_RUNTIME_UNAUTHORIZED", 401),
    } satisfies RuntimeRequestResult;
  }
  const body = yield* readJsonBody(request, maxBytes).pipe(Effect.either);
  if (Either.isLeft(body)) {
    return {
      kind: "rejected",
      result: bodyFailureResult(body.left),
    } satisfies RuntimeRequestResult;
  }
  return {
    body: body.right,
    kind: "accepted",
  } satisfies RuntimeRequestResult;
});
