import "@tanstack/react-start/server-only";

import { sha256Hex } from "@repo/utilities/digest";
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

/** The Runtime Cache or the digest of a key failed, so the store cannot answer. */
export class ContentStoreUnavailableError extends Schema.TaggedError<ContentStoreUnavailableError>()(
  "ContentStoreUnavailableError",
  {
    cause: Schema.Unknown,
    operation: Schema.Literals([
      "digest",
      "expire",
      "invalidate",
      "read",
      "write",
    ]),
  }
) {}

/** The most bytes one entry may take as JSON. The Runtime Cache documents 2 MB. */
const MAX_ENTRY_BYTES = 2_000_000;

/** The most tags one entry may carry. */
const MAX_ENTRY_TAGS = 128;

/** The most UTF-8 bytes one tag may take. */
const MAX_TAG_BYTES = 256;

/** A write that the Runtime Cache refuses by its limits, so it is never sent. */
export class ContentStoreLimitError extends Schema.TaggedError<ContentStoreLimitError>()(
  "ContentStoreLimitError",
  {
    limit: Schema.Literals([
      "entry-bytes",
      "tag-bytes",
      "tag-comma",
      "tag-count",
    ]),
  }
) {}

/** The repeats of a purge that the platform rate-limits, after its first call. */
const PURGE_REPEATS = 3;

/** The wait of a rate-limited purge that does not name one. */
const DEFAULT_RETRY_AFTER = Duration.seconds(1);

/**
 * Version of every stored shape. Bump it whenever a stored schema changes in a
 * way that an entry of the old shape would still decode, so new code never
 * reads an entry that old code wrote. The store holds only what Convex
 * answered, never a value that code derives from an answer, so a change in a
 * derivation needs no bump: it takes effect with the deploy. The version is a
 * constant and never the build id: the build id changes with every deploy, and
 * the store exists to survive deploys.
 */
const CONTENT_STORE_VERSION = "1";

/**
 * The Vercel Runtime Cache for content. Every key reaches it already digested,
 * so the default 32 bit key hash is replaced by the identity: that hash is
 * cheap to collide from a request path, and a collision would serve one route
 * the stored answer of another.
 */
const runtimeCache = getCache({
  keyHashFunction: (key) => key,
  namespace: "content",
});

/** Digests one key into the opaque text that the Runtime Cache stores it under. */
const makeStoreKey = Effect.fn("www.content.store.key")(function* (
  parts: readonly string[]
) {
  return yield* sha256Hex(
    encodeJsonText([CONTENT_STORE_VERSION, ...parts])
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ContentStoreUnavailableError({ cause, operation: "digest" })
    )
  );
});

/**
 * Wraps one value in a JSON codec derived from its schema. The wrapper keeps a
 * stored `null` apart from a miss, because the Runtime Cache answers a miss
 * with `null`.
 */
function makeEntryCodec<A, I>(schema: Schema.Codec<A, I, never, never>) {
  return Schema.toCodecJson(Schema.Struct({ value: schema }));
}

/** Reports a store failure that the caller survives by going to the source. */
const warnUnavailable = (error: ContentStoreUnavailableError) =>
  Effect.logWarning(
    "The content store is unavailable.",
    error.operation,
    error.cause
  );

/** Reports a value that the store skips because the Runtime Cache would refuse it. */
const warnLimit = (error: ContentStoreLimitError) =>
  Effect.logWarning(
    "The content store skipped a value over a Runtime Cache limit.",
    error.limit
  );

/** The UTF-8 length of a text. */
function byteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}

/**
 * Refuses one entry before any call when it breaks a platform limit: a tag with
 * a comma, too many tags, a tag over 256 bytes, or an entry over 2 MB as JSON.
 */
const checkStoreLimits = Effect.fn("www.content.store.limits")(function* (
  entry: unknown,
  tags: readonly string[]
) {
  if (Arr.some(tags, (tag) => tag.includes(","))) {
    return yield* new ContentStoreLimitError({ limit: "tag-comma" });
  }
  if (tags.length > MAX_ENTRY_TAGS) {
    return yield* new ContentStoreLimitError({ limit: "tag-count" });
  }
  if (Arr.some(tags, (tag) => byteLength(tag) > MAX_TAG_BYTES)) {
    return yield* new ContentStoreLimitError({ limit: "tag-bytes" });
  }
  if (byteLength(encodeJsonText(entry)) > MAX_ENTRY_BYTES) {
    return yield* new ContentStoreLimitError({ limit: "entry-bytes" });
  }
});

/**
 * Reads one stored value. A missing, expired or undecodable entry and an
 * unavailable store are all a miss, so the caller loads the value again.
 */
export const readStoreEntry = Effect.fn("www.content.store.readEntry")(
  function* <A, I>(input: {
    readonly parts: readonly string[];
    readonly schema: Schema.Codec<A, I, never, never>;
  }) {
    const read = Effect.gen(function* () {
      const key = yield* makeStoreKey(input.parts);
      const stored = yield* Effect.tryPromise({
        catch: (cause) =>
          new ContentStoreUnavailableError({ cause, operation: "read" }),
        try: () => runtimeCache.get(key),
      });
      return Option.map(
        Schema.decodeUnknownOption(makeEntryCodec(input.schema))(stored),
        ({ value }) => value
      );
    });
    return yield* read.pipe(
      Effect.catchTag("ContentStoreUnavailableError", (error) =>
        warnUnavailable(error).pipe(Effect.as(Option.none<A>()))
      )
    );
  }
);

/**
 * Writes one value under its tags for its lifetime. A write that fails, or one
 * that the platform limits refuse, leaves the value uncached and never fails the
 * caller, which already holds the value.
 */
export const writeStoreEntry = Effect.fn("www.content.store.writeEntry")(
  function* <A, I>(input: {
    readonly name: string;
    readonly parts: readonly string[];
    readonly schema: Schema.Codec<A, I, never, never>;
    readonly tags: readonly string[];
    readonly ttl: Duration.Input;
    readonly value: A;
  }) {
    const write = Effect.gen(function* () {
      const key = yield* makeStoreKey(input.parts);
      const entry = yield* Schema.encodeEffect(makeEntryCodec(input.schema))({
        value: input.value,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new ContentStoreUnavailableError({ cause, operation: "write" })
        )
      );
      yield* checkStoreLimits(entry, input.tags);
      yield* Effect.tryPromise({
        catch: (cause) =>
          new ContentStoreUnavailableError({ cause, operation: "write" }),
        try: () =>
          runtimeCache.set(key, entry, {
            name: input.name,
            tags: [...input.tags],
            ttl: Duration.toSeconds(input.ttl),
          }),
      });
    });
    yield* write.pipe(
      Effect.catchTags({
        ContentStoreLimitError: warnLimit,
        ContentStoreUnavailableError: warnUnavailable,
      })
    );
  }
);

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
function readRetryAfter(cause: unknown): Option.Option<Duration.Duration> {
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

/**
 * Runs one purge call. A rate-limited call waits for its `retry-after` and
 * repeats, up to `repeats` times. Any other failure, or one more rate limit
 * after the last repeat, fails with the cause.
 */
function purge(
  operation: "expire" | "invalidate",
  run: () => Promise<void>,
  repeats: number
): Effect.Effect<void, ContentStoreUnavailableError> {
  return Effect.tryPromise({
    catch: (cause) => new ContentStoreUnavailableError({ cause, operation }),
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

/**
 * Expires every entry that carries one tag, in every region. The Runtime Cache
 * client reports a failed request to the console and resolves, so only a client
 * that throws fails here, after a rate-limited call has waited and repeated.
 */
export const expireStoreTag = Effect.fn("www.content.store.expireTag")(
  function* (tag: string) {
    yield* purge("expire", () => runtimeCache.expireTag(tag), PURGE_REPEATS);
  }
);

/**
 * Marks every CDN response that carries one tag as stale, so the next request
 * serves it and revalidates in the background.
 */
export const invalidateStoreTag = Effect.fn("www.content.store.invalidateTag")(
  function* (tag: string) {
    yield* purge("invalidate", () => invalidateByTag(tag), PURGE_REPEATS);
  }
);
