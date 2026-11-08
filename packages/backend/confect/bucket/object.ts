import { objectAddress } from "@repo/backend/confect/bucket/sign";
import { Duration, Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/** How long an action waits for R2 before it gives up on one request. */
const BUCKET_DEADLINE = Duration.seconds(20);

/** The lifetime of an address that the server itself uses at once. */
const SERVER_SECONDS = 60;

/** R2 did not answer, or answered a request with a status it should not. */
export class BucketFailed extends Schema.TaggedError<
  BucketFailed,
  { readonly brand: unique symbol }
>()("BucketFailed", { status: Schema.optionalKey(Schema.Int) }) {}

/** The failure of a request that R2 never answered, or whose body never arrived. */
const unreached = () => new BucketFailed({});

/** Sends one request to R2 and answers its response, refusing any status but a success or a missing object. */
const send = Effect.fn("bucket.send")(function* (
  request: HttpClientRequest.HttpClientRequest
) {
  const response = yield* (yield* HttpClient.HttpClient)
    .execute(request)
    .pipe(Effect.timeout(BUCKET_DEADLINE), Effect.mapError(unreached));
  if (
    response.status !== 404 &&
    (response.status < 200 || response.status >= 300)
  ) {
    return yield* new BucketFailed({ status: response.status });
  }
  return response;
});

/**
 * The size of one stored object and its leading bytes, which name its type. An object R2 does not hold has
 * neither, so an upload that never arrived is told from one that did.
 */
export const inspectObject = Effect.fn("bucket.inspect")(function* (
  key: string,
  headBytes: number
) {
  const head = yield* send(
    HttpClientRequest.head(
      yield* objectAddress(key, {
        expiresSeconds: SERVER_SECONDS,
        method: "HEAD",
      })
    )
  );
  if (head.status === 404) {
    return Option.none();
  }
  const byteSize = Number(head.headers["content-length"]);
  const range = yield* send(
    HttpClientRequest.get(
      yield* objectAddress(key, {
        expiresSeconds: SERVER_SECONDS,
        headers: { range: `bytes=0-${headBytes - 1}` },
        method: "GET",
      })
    ).pipe(HttpClientRequest.setHeader("range", `bytes=0-${headBytes - 1}`))
  );
  const bytes = new Uint8Array(
    yield* range.arrayBuffer.pipe(Effect.mapError(unreached))
  );
  return Option.some({ byteSize, head: bytes.slice(0, headBytes) });
}, Effect.scoped);

/** The whole bytes of one stored object, for the server's own reading of a file. */
export const readObject = Effect.fn("bucket.read")(function* (key: string) {
  const response = yield* send(
    HttpClientRequest.get(
      yield* objectAddress(key, {
        expiresSeconds: SERVER_SECONDS,
        method: "GET",
      })
    )
  );
  if (response.status === 404) {
    return Option.none();
  }
  return Option.some(
    new Uint8Array(yield* response.arrayBuffer.pipe(Effect.mapError(unreached)))
  );
}, Effect.scoped);

/** Stores bytes the server read itself, such as a file imported from Google Drive. */
export const putObject = Effect.fn("bucket.put")(function* (
  key: string,
  bytes: Uint8Array,
  contentType: string
) {
  const headers = {
    "content-length": String(bytes.byteLength),
    "content-type": contentType,
  };
  yield* send(
    HttpClientRequest.put(
      yield* objectAddress(key, {
        expiresSeconds: SERVER_SECONDS,
        headers,
        method: "PUT",
      })
    ).pipe(HttpClientRequest.bodyUint8Array(bytes, contentType))
  );
}, Effect.scoped);

/** Deletes one object. An object already gone is deleted. */
export const removeObject = Effect.fn("bucket.remove")(function* (key: string) {
  yield* send(
    HttpClientRequest.delete(
      yield* objectAddress(key, {
        expiresSeconds: SERVER_SECONDS,
        method: "DELETE",
      })
    )
  );
}, Effect.scoped);
