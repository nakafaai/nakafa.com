import {
  ContentCacheReceiptSchema,
  ContentCacheRequestSchema,
} from "@nakafa/aksara-contracts/cache/content";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Schema } from "effect";
import { env } from "@/env";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";
import {
  type ActiveContentReleaseId,
  confirmActiveContentIdentity,
  expireActiveContentIdentity,
  loadActiveContentIdentity,
} from "@/lib/content/published/active";

const PRIVATE_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };
const MAX_CACHE_REQUEST_BYTES = 32 * 1024;

/** A bounded cache invalidation request cannot be safely decoded. */
class CacheRequestError extends Schema.TaggedError<CacheRequestError>()(
  "CacheRequestError",
  { reason: Schema.Literals(["body", "content-type", "size"]) }
) {}

/** Maps one bounded-body failure to its stable client status. */
function cacheRequestStatus(error: CacheRequestError) {
  if (error.reason === "size") {
    return 413;
  }
  if (error.reason === "content-type") {
    return 415;
  }
  return 400;
}

/** Answers with a JSON body that no cache may keep. */
function privateJson(body: object, status = 200) {
  return Response.json(body, { headers: PRIVATE_RESPONSE_HEADERS, status });
}

/** Reads one exact release-bound publication dependency invalidation request. */
const readCacheRequest = Effect.fn("NakafaContent.readCacheRequest")(function* (
  request: Request
) {
  const declaredLength = yield* parseContentLength(
    request.headers.get("content-length"),
    MAX_CACHE_REQUEST_BYTES
  ).pipe(Effect.mapError(() => new CacheRequestError({ reason: "size" })));
  if (!request.body) {
    return yield* new CacheRequestError({ reason: "body" });
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return yield* new CacheRequestError({ reason: "content-type" });
  }
  const bytes = yield* readBoundedBody(
    request.body,
    MAX_CACHE_REQUEST_BYTES
  ).pipe(
    Effect.mapError(
      (error) =>
        new CacheRequestError({
          reason: error._tag === "BodyLimitError" ? "size" : "body",
        })
    )
  );
  if (declaredLength !== null && declaredLength !== bytes.byteLength) {
    return yield* new CacheRequestError({ reason: "body" });
  }
  if (bytes.byteLength === 0) {
    return yield* new CacheRequestError({ reason: "body" });
  }
  const source = yield* Effect.try({
    catch: () => new CacheRequestError({ reason: "body" }),
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  });
  return yield* Schema.decodeEffect(
    Schema.fromJsonString(ContentCacheRequestSchema)
  )(source, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new CacheRequestError({ reason: "body" }))
  );
});

/**
 * Makes the activated release the one this isolate reads. The stored pointer goes
 * first and is proved gone, so a read that refills the pointer after this call
 * reads the release that this call activates. The last expiry drops a pointer
 * that a read which began before the activation wrote after the first one, so
 * the next read asks Convex.
 *
 * Nothing else is cached: every other read goes to Convex, and the prerendered
 * pages come from the release build, so there is no CDN copy to purge.
 */
const refreshActiveRelease = Effect.fn("NakafaContent.refreshActiveRelease")(
  function* (releaseId: ActiveContentReleaseId) {
    yield* expireActiveContentIdentity();
    yield* confirmActiveContentIdentity(releaseId);
    yield* expireActiveContentIdentity();
  }
);

/** Answers one receipt request: bearer, body, active release, refresh. */
const answerCacheRequest = Effect.fn("NakafaContent.receiveCache")(function* (
  request: Request
) {
  const isAuthorized = yield* isInternalContentAuthorized(
    request.headers.get("Authorization"),
    env.AKSARA_PUBLICATION_TOKEN
  );
  if (!isAuthorized) {
    return privateJson({ error: "Unauthorized" }, 401);
  }
  const decoded = yield* readCacheRequest(request).pipe(Effect.result);
  if (decoded._tag === "Failure") {
    return privateJson(
      { error: "Invalid cache invalidation request." },
      cacheRequestStatus(decoded.failure)
    );
  }
  // The stored pointer may still name the previous release, so the check asks
  // Convex.
  const active = yield* loadActiveContentIdentity();
  if (active?.releaseId !== decoded.success.releaseId) {
    return privateJson({ error: "Content release is not active." }, 409);
  }
  const refresh = yield* refreshActiveRelease(decoded.success.releaseId).pipe(
    Effect.result
  );
  if (refresh._tag === "Failure") {
    return privateJson({ error: "Content cache invalidation failed." }, 503);
  }
  return privateJson(
    ContentCacheReceiptSchema.make({
      releaseId: decoded.success.releaseId,
      revalidated: true,
      scope: decoded.success.scope,
    })
  );
});

/** Answers the publisher's receipt for one activated release, the publisher's activation call. */
export function receiveContentCache({
  request,
}: {
  readonly request: Request;
}) {
  return Effect.runPromise(answerCacheRequest(request));
}
