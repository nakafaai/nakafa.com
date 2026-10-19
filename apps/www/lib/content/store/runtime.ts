import "@tanstack/react-start/server-only";
import { encodeJsonText } from "@repo/utilities/json";
import { getCache, invalidateByTag } from "@vercel/functions";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Record as Rec,
  Schema,
} from "effect";

/** The most bytes one item may take. The docs say 2 MB, and the smaller reading is used. */
export const MAX_ITEM_BYTES = 2_000_000;

/** The most tags one item may carry. */
export const MAX_ITEM_TAGS = 128;

/** The most UTF-8 bytes one tag may take. */
export const MAX_TAG_BYTES = 256;

/** The repeats of a purge that the platform rate-limits, after its first call. */
const PURGE_REPEATS = 3;

/** The wait of a rate-limited purge that does not name one. */
const DEFAULT_RETRY_AFTER = Duration.seconds(1);

/** A write that the Runtime Cache refuses by its limits, so it is never sent. */
export class RuntimeCacheLimit extends Schema.TaggedError<RuntimeCacheLimit>()(
  "RuntimeCacheLimit",
  {
    limit: Schema.Literals([
      "item-bytes",
      "tag-bytes",
      "tag-comma",
      "tag-count",
    ]),
  }
) {}

/** The Runtime Cache or the platform purge did not answer, after any repeat. */
export class RuntimeCacheUnavailable extends Schema.TaggedError<RuntimeCacheUnavailable>()(
  "RuntimeCacheUnavailable",
  {
    cause: Schema.Unknown,
    operation: Schema.Literals(["expire", "get", "invalidate", "set"]),
  }
) {}

/**
 * The Vercel Runtime Cache for content. Keys reach it already digested by the
 * store, so the default key hash is replaced by the identity, as the store does:
 * a 32 bit hash could let one route read another route's answer.
 */
const cache = getCache({
  keyHashFunction: (key) => key,
  namespace: "content",
});

/** The UTF-8 length of a text. */
function byteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}

/**
 * Refuses one item before any call when it breaks a platform limit: a tag with
 * a comma, too many tags, a tag over 256 bytes, or a value over 2 MB as JSON.
 */
const checkItem = Effect.fn("www.content.runtimeCache.checkItem")(function* (
  value: unknown,
  tags: readonly string[]
) {
  if (Arr.some(tags, (tag) => tag.includes(","))) {
    return yield* new RuntimeCacheLimit({ limit: "tag-comma" });
  }
  if (tags.length > MAX_ITEM_TAGS) {
    return yield* new RuntimeCacheLimit({ limit: "tag-count" });
  }
  if (Arr.some(tags, (tag) => byteLength(tag) > MAX_TAG_BYTES)) {
    return yield* new RuntimeCacheLimit({ limit: "tag-bytes" });
  }
  if (byteLength(encodeJsonText(value)) > MAX_ITEM_BYTES) {
    return yield* new RuntimeCacheLimit({ limit: "item-bytes" });
  }
});

/** The answer of a purge that the platform rate-limits, with its headers. */
const RateLimited = Schema.Struct({
  headers: Schema.Record(Schema.String, Schema.String),
  status: Schema.Literal(429),
});

const isRateLimited = Schema.is(RateLimited);

/**
 * The wait that a rate-limited purge asks for in its `retry-after` header, in
 * seconds. A failure that is not a rate limit has no wait. A rate limit without
 * a usable header waits for the default.
 */
export function readRetryAfter(
  cause: unknown
): Option.Option<Duration.Duration> {
  if (!isRateLimited(cause)) {
    return Option.none();
  }
  return Option.some(
    Option.match(Rec.get(cause.headers, "retry-after"), {
      onNone: () => DEFAULT_RETRY_AFTER,
      onSome: (value) => {
        const seconds = Number(value);
        return Number.isFinite(seconds) && seconds >= 0
          ? Duration.seconds(seconds)
          : DEFAULT_RETRY_AFTER;
      },
    })
  );
}

/** Reads one stored value by its digested key. A miss is none. */
export const getRuntimeCacheEntry = Effect.fn("www.content.runtimeCache.get")(
  function* (key: string) {
    const stored = yield* Effect.tryPromise({
      catch: (cause) =>
        new RuntimeCacheUnavailable({ cause, operation: "get" }),
      try: () => cache.get(key),
    });
    return Option.fromNullishOr(stored);
  }
);

/**
 * Stores one value under its tags for its lifetime, after the item is checked
 * against the platform limits.
 */
export const setRuntimeCacheEntry = Effect.fn("www.content.runtimeCache.set")(
  function* (input: {
    readonly key: string;
    readonly name: string;
    readonly tags: readonly string[];
    readonly ttl: Duration.Input;
    readonly value: unknown;
  }) {
    yield* checkItem(input.value, input.tags);
    yield* Effect.tryPromise({
      catch: (cause) =>
        new RuntimeCacheUnavailable({ cause, operation: "set" }),
      try: () =>
        cache.set(input.key, input.value, {
          name: input.name,
          tags: [...input.tags],
          ttl: Duration.toSeconds(input.ttl),
        }),
    });
  }
);

/**
 * Runs one purge call. A rate-limited call waits for its `retry-after` and
 * repeats, up to `repeats` times. Any other failure, or one more rate limit
 * after the last repeat, fails with the cause.
 */
function purge(
  operation: "expire" | "invalidate",
  run: () => Promise<void>,
  repeats: number
): Effect.Effect<void, RuntimeCacheUnavailable> {
  return Effect.tryPromise({
    catch: (cause) => new RuntimeCacheUnavailable({ cause, operation }),
    try: run,
  }).pipe(
    Effect.catch((failure) => {
      const wait = readRetryAfter(failure.cause);
      if (Option.isSome(wait) && repeats > 0) {
        return Effect.sleep(wait.value).pipe(
          Effect.andThen(purge(operation, run, repeats - 1))
        );
      }
      return Effect.fail(failure);
    })
  );
}

/** Expires every stored entry that carries one tag. */
export const expireRuntimeCacheTag = Effect.fn(
  "www.content.runtimeCache.expireTag"
)(function* (tag: string) {
  yield* purge("expire", () => cache.expireTag(tag), PURGE_REPEATS);
});

/**
 * Marks every CDN response that carries one tag as stale, so the next request
 * serves it and revalidates in the background.
 */
export const invalidateRuntimeCacheTag = Effect.fn(
  "www.content.runtimeCache.invalidateTag"
)(function* (tag: string) {
  yield* purge("invalidate", () => invalidateByTag(tag), PURGE_REPEATS);
});
