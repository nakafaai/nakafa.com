import "@tanstack/react-start/server-only";

import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import { Cause, Clock, Duration, Effect, Option, Schema } from "effect";
import { makeMemoryStore } from "@/lib/content/store/memory";

/** A value could not be encoded, so the store cannot keep it. */
class ContentStoreUnavailableError extends Schema.TaggedError<ContentStoreUnavailableError>()(
  "ContentStoreUnavailableError",
  {
    cause: Schema.Unknown,
  }
) {}

/** The most bytes one entry may take as JSON, so one value never fills the isolate's store. */
const MAX_ENTRY_BYTES = 2_000_000;

/** A write that the store refuses by its limit, so it is never kept. */
class ContentStoreLimitError extends Schema.TaggedError<ContentStoreLimitError>()(
  "ContentStoreLimitError",
  {
    limit: Schema.Literals(["entry-bytes"]),
  }
) {}

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
 * The store of this isolate. Every key reaches it already digested, so the
 * store never compares keys that a request path could shape.
 */
const runtimeCache = makeMemoryStore();

/** Digests one key into the opaque text that the store keeps it under. */
const makeStoreKey = Effect.fn("www.content.store.key")(function* (
  parts: readonly string[]
) {
  return yield* sha256Hex(encodeJsonText([CONTENT_STORE_VERSION, ...parts]));
});

/**
 * Wraps one value in a JSON codec derived from its schema. The wrapper keeps a
 * stored `null` apart from a miss.
 */
function makeEntryCodec<A, I>(schema: Schema.Codec<A, I, never, never>) {
  return Schema.toCodecJson(Schema.Struct({ value: schema }));
}

/** Reports a value that the store skips because it is over the entry limit. */
const warnLimit = (error: ContentStoreLimitError) =>
  Effect.logWarning(
    "The content store skipped a value over its entry limit.",
    error.limit
  );

/** Reports a value that the store could not encode, which the caller already holds. */
const warnUnavailable = (error: ContentStoreUnavailableError) =>
  Effect.logWarning(
    "The content store could not encode a value.",
    Cause.fail(error.cause)
  );

/** The UTF-8 length of a text. */
function byteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}

/** Refuses one entry before it is kept when it is over the entry limit. */
const checkStoreLimit = Effect.fn("www.content.store.limit")(function* (
  entry: unknown
) {
  if (byteLength(encodeJsonText(entry)) > MAX_ENTRY_BYTES) {
    return yield* new ContentStoreLimitError({ limit: "entry-bytes" });
  }
});

/**
 * Reads one stored value. A missing or expired entry and an entry that does not
 * decode are all a miss, so the caller loads the value again.
 */
export const readStoreEntry = Effect.fn("www.content.store.readEntry")(
  function* <A, I>(input: {
    readonly parts: readonly string[];
    readonly schema: Schema.Codec<A, I, never, never>;
  }) {
    const key = yield* makeStoreKey(input.parts);
    const now = yield* Clock.currentTimeMillis;
    const stored = runtimeCache.get(key, now);
    return Option.flatMap(stored, (value) =>
      Schema.decodeUnknownOption(makeEntryCodec(input.schema))(value)
    ).pipe(Option.map(({ value }) => value));
  }
);

/**
 * Keeps one value under its tags for its lifetime. A write that fails, or one
 * that the limit refuses, leaves the value uncached and never fails the caller,
 * which already holds the value.
 */
export const writeStoreEntry = Effect.fn("www.content.store.writeEntry")(
  function* <A, I>(input: {
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
        Effect.mapError((cause) => new ContentStoreUnavailableError({ cause }))
      );
      yield* checkStoreLimit(entry);
      const now = yield* Clock.currentTimeMillis;
      runtimeCache.set(key, entry, {
        expiresAt: now + Duration.toMillis(input.ttl),
        now,
        tags: input.tags,
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

/**
 * Drops every entry of this isolate that carries one tag. The other isolates
 * drop theirs when each entry's lifetime ends, so a lifetime bounds how long any
 * isolate can keep a value that a tag was meant to drop.
 */
export const expireStoreTag = Effect.fn("www.content.store.expireTag")(
  (tag: string) => Effect.sync(() => runtimeCache.expireTag(tag))
);
