import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Schema } from "effect";

/** Expected bounded HTTP body rejection before domain decoding begins. */
export class HttpBodyError extends Schema.TaggedError<HttpBodyError>()(
  "HttpBodyError",
  {
    reason: Schema.Literal("invalid", "size", "unsupported"),
  }
) {}

/** Complete UTF-8 JSON request body accepted by one HTTP adapter. */
export interface HttpJsonBody {
  readonly byteLength: number;
  readonly source: string;
}

/** Creates one sanitized body failure without retaining request bytes. */
function bodyError(reason: HttpBodyError["reason"]) {
  return new HttpBodyError({ reason });
}

/** Reads one complete JSON request while enforcing its endpoint byte ceiling. */
export const readJsonBody = Effect.fn("contentRelease.readJsonBody")(function* (
  request: Request,
  maxBytes: number
) {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return yield* bodyError("unsupported");
  }
  const declaredLength = yield* parseContentLength(
    request.headers.get("content-length"),
    maxBytes
  ).pipe(
    Effect.mapError((error) =>
      bodyError(error.reason === "limit" ? "size" : "invalid")
    )
  );
  if (!request.body) {
    if (declaredLength !== null && declaredLength !== 0) {
      return yield* bodyError("invalid");
    }
    return { byteLength: 0, source: "" } satisfies HttpJsonBody;
  }
  const bytes = yield* readBoundedBody(request.body, maxBytes).pipe(
    Effect.mapError((error) =>
      bodyError(error._tag === "BodyLimitError" ? "size" : "invalid")
    )
  );
  if (declaredLength !== null && declaredLength !== bytes.byteLength) {
    return yield* bodyError("invalid");
  }
  const source = yield* Effect.try({
    catch: () => bodyError("invalid"),
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  });
  return { byteLength: bytes.byteLength, source } satisfies HttpJsonBody;
});
