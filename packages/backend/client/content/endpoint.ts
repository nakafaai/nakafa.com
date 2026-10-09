import { ContentTransportError } from "@repo/backend/client/content/errors";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, HashSet, Schema } from "effect";

const LOOPBACK_HOSTS = HashSet.make("127.0.0.1", "[::1]", "localhost");

const ContentHttpTargetSchema = Schema.Struct({
  siteUrl: Schema.String,
  token: Schema.String,
});
/** Server-owned connection values for private Convex content endpoints. */
export type ContentHttpTarget = typeof ContentHttpTargetSchema.Type;

/** Builds one fixed private endpoint without inheriting paths or credentials. */
export const createContentEndpoint = Effect.fn(
  "NakafaContent.createContentEndpoint"
)(function* (baseUrl: string, path: string) {
  const base = yield* Effect.try({
    catch: () =>
      new ContentTransportError({
        reason: "url",
      }),
    try: () => new URL(baseUrl),
  });
  const isLocalHttp =
    base.protocol === "http:" && HashSet.has(LOOPBACK_HOSTS, base.hostname);
  if (
    (base.protocol !== "https:" && !isLocalHttp) ||
    base.username.length + base.password.length > 0
  ) {
    return yield* new ContentTransportError({
      reason: "url",
    });
  }
  return new URL(path, base.origin).href;
});

/** Serializes one request while enforcing its complete UTF-8 byte ceiling. */
export const encodeContentRequest = Effect.fn(
  "NakafaContent.encodeContentRequest"
)(function* (input: unknown, maxBytes: number) {
  const source = yield* Schema.encodeEffect(JsonTextSchema)(input).pipe(
    Effect.mapError(
      () =>
        new ContentTransportError({
          reason: "request",
        })
    )
  );
  if (new TextEncoder().encode(source).byteLength > maxBytes) {
    return yield* new ContentTransportError({
      reason: "request-size",
    });
  }
  return source;
});
