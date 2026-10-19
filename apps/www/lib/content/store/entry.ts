import "@tanstack/react-start/server-only";

import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import { getCache } from "@vercel/functions";
import { Duration, Effect, Option, Schema } from "effect";

/** The Runtime Cache or the digest of a key failed, so the store cannot answer. */
export class ContentStoreUnavailableError extends Schema.TaggedError<ContentStoreUnavailableError>()(
  "ContentStoreUnavailableError",
  {
    cause: Schema.Unknown,
    operation: Schema.Literals(["digest", "expire", "read", "write"]),
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
 * Writes one value under its tags for its lifetime. A write that fails leaves
 * the value uncached and never fails the caller, which already holds the value.
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
      Effect.catchTag("ContentStoreUnavailableError", warnUnavailable)
    );
  }
);

/**
 * Expires every entry that carries one tag, in every region. The Runtime Cache
 * client reports a failed request to the console and resolves, so only a client
 * that throws fails here.
 */
export const expireStoreTag = Effect.fn("www.content.store.expireTag")(
  function* (tag: string) {
    yield* Effect.tryPromise({
      catch: (cause) =>
        new ContentStoreUnavailableError({ cause, operation: "expire" }),
      try: () => runtimeCache.expireTag(tag),
    });
  }
);
