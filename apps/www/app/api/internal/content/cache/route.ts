import {
  ContentCacheReceiptSchema,
  ContentCacheRequestSchema,
} from "@nakafa/aksara-contracts/cache/content";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { revalidateContentCache } from "@/lib/content/cache";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";
import { readActiveContentIdentity } from "@/lib/content/published/active";

const PRIVATE_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };
const MAX_CACHE_REQUEST_BYTES = 32 * 1024;
/** A bounded cache invalidation request cannot be safely decoded. */
class CacheRequestError extends Schema.TaggedError<CacheRequestError>()(
  "CacheRequestError",
  { reason: Schema.Literal("body", "content-type", "size") }
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

/** Reads one exact release-bound content-family invalidation request. */
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
  const input = yield* Effect.try({
    catch: () => new CacheRequestError({ reason: "body" }),
    try: (): unknown => JSON.parse(source),
  });
  return yield* Schema.decodeUnknown(ContentCacheRequestSchema)(input, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new CacheRequestError({ reason: "body" })));
});

/**
 * Revalidates Convex-backed content runtime cache tags for trusted sync scripts.
 */
export const POST = (request: NextRequest) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const isAuthorized = isInternalContentAuthorized(
        request.headers.get("Authorization"),
        env.INTERNAL_CONTENT_API_KEY
      );

      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { headers: PRIVATE_RESPONSE_HEADERS, status: 401 }
        );
      }

      const decoded = yield* readCacheRequest(request).pipe(Effect.either);
      if (decoded._tag === "Left") {
        return NextResponse.json(
          { error: "Invalid cache invalidation request." },
          {
            headers: PRIVATE_RESPONSE_HEADERS,
            status: cacheRequestStatus(decoded.left),
          }
        );
      }
      const active = yield* readActiveContentIdentity();
      if (active?.releaseId !== decoded.right.releaseId) {
        return NextResponse.json(
          { error: "Content release is not active." },
          { headers: PRIVATE_RESPONSE_HEADERS, status: 409 }
        );
      }
      const tags = revalidateContentCache(decoded.right.tags);

      return NextResponse.json(
        ContentCacheReceiptSchema.make({
          family: decoded.right.family,
          releaseId: decoded.right.releaseId,
          revalidated: true,
          tags,
        }),
        { headers: PRIVATE_RESPONSE_HEADERS }
      );
    })
  );
