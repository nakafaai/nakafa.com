import {
  ContentCacheReceiptSchema,
  ContentCacheRequestSchema,
  type ContentCacheScope,
} from "@nakafa/aksara-contracts/cache/content";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { invalidateContentCache } from "@/lib/content/cache";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";
import {
  type ActiveContentReleaseId,
  confirmActiveContentIdentity,
  expireActiveContentIdentity,
  loadActiveContentIdentity,
} from "@/lib/content/published/active";
import { invalidateOgCache } from "@/lib/og/cache";
import { invalidateSitemapCache } from "@/lib/sitemap/cache";

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
/** Reads one exact release-bound publication dependency invalidation request. */
const readCacheRequest = Effect.fn("NakafaContent.readCacheRequest")(function* (
  request: NextRequest
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
 * Expires the stored release pointer and proves the expiry, then revalidates
 * one Next content tag, then purges the shared sitemap response and the social
 * images once for the release, then expires the pointer again. The pointer goes
 * first: a page that refills after the revalidation must read the release that
 * this call activates and not the one it replaces. The Runtime Cache client
 * resolves even when an expiry failed, so the call reads the pointer back and
 * stops before it revalidates anything when the pointer still names the
 * previous release. The last expiry drops a pointer that a read which began
 * before the activation wrote after the first one, so a sitemap that
 * regenerates after the purge asks Convex. The publisher repeats a call that
 * answers 503. A social image that stays at the CDN is stale for at most its
 * lifetime and is cosmetic, so a purge of the images that fails is logged and
 * never fails the activation.
 */
const invalidateContentRuntime = Effect.fn("NakafaContent.invalidateRuntime")(
  function* (scope: ContentCacheScope, releaseId: ActiveContentReleaseId) {
    yield* expireActiveContentIdentity();
    yield* confirmActiveContentIdentity(releaseId);
    yield* invalidateContentCache(scope);
    yield* invalidateSitemapCache(releaseId);
    yield* invalidateOgCache(releaseId).pipe(Effect.ignore({ log: "Warn" }));
    yield* expireActiveContentIdentity();
  }
);

/**
 * Revalidates Convex-backed content runtime cache tags for trusted sync scripts.
 */
export const POST = (request: NextRequest) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const isAuthorized = yield* isInternalContentAuthorized(
        request.headers.get("Authorization"),
        env.AKSARA_PUBLICATION_TOKEN
      );
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { headers: PRIVATE_RESPONSE_HEADERS, status: 401 }
        );
      }
      const decoded = yield* readCacheRequest(request).pipe(Effect.result);
      if (decoded._tag === "Failure") {
        return NextResponse.json(
          { error: "Invalid cache invalidation request." },
          {
            headers: PRIVATE_RESPONSE_HEADERS,
            status: cacheRequestStatus(decoded.failure),
          }
        );
      }
      // The stored pointer may still name the previous release, so the check
      // asks Convex.
      const active = yield* loadActiveContentIdentity();
      if (active?.releaseId !== decoded.success.releaseId) {
        return NextResponse.json(
          { error: "Content release is not active." },
          { headers: PRIVATE_RESPONSE_HEADERS, status: 409 }
        );
      }
      const invalidation = yield* invalidateContentRuntime(
        decoded.success.scope,
        decoded.success.releaseId
      ).pipe(Effect.result);
      if (invalidation._tag === "Failure") {
        return NextResponse.json(
          { error: "Content cache invalidation failed." },
          { headers: PRIVATE_RESPONSE_HEADERS, status: 503 }
        );
      }
      return NextResponse.json(
        ContentCacheReceiptSchema.make({
          scope: decoded.success.scope,
          releaseId: decoded.success.releaseId,
          revalidated: true,
        }),
        { headers: PRIVATE_RESPONSE_HEADERS }
      );
    })
  );
