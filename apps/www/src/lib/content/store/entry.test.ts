// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option, Schema } from "effect";
import {
  expireStoreTag,
  readStoreEntry,
  writeStoreEntry,
} from "@/lib/content/store/entry";
import {
  resetTestRuntimeCache,
  STORE_KEY_PATTERN,
  testRuntimeCache,
} from "@/test/store";

vi.mock("@/lib/content/store/memory", async () => {
  const { testRuntimeCacheModule } = await import("@/test/store");
  return testRuntimeCacheModule;
});

const TextSchema = Schema.String;
const parts = ["page.catalog", "en"];

/** The digest that the store gave the key of the last write. */
function lastKey() {
  const key = Arr.last(testRuntimeCache.set.mock.calls).pipe(
    Option.map(([written]) => written),
    Option.getOrThrow
  );
  expect(key).toMatch(STORE_KEY_PATTERN);
  return key;
}

beforeEach(() => {
  resetTestRuntimeCache();
});

describe("content store entries", () => {
  it.effect("keeps a value under an opaque digest of its parts", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts,
        schema: TextSchema,
        tags: ["tag"],
        ttl: "1 minute",
        value: "text",
      });

      expect(lastKey()).toMatch(STORE_KEY_PATTERN);
      expect(
        yield* readStoreEntry({ parts, schema: TextSchema })
      ).toStrictEqual(Option.some("text"));
    })
  );

  it.effect("keeps different parts apart", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts,
        schema: TextSchema,
        tags: [],
        ttl: "1 minute",
        value: "text",
      });

      expect(
        yield* readStoreEntry({
          parts: ["page.catalog", "de"],
          schema: TextSchema,
        })
      ).toStrictEqual(Option.none());
    })
  );

  it.effect("tells a stored null from a miss", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts,
        schema: Schema.NullOr(Schema.String),
        tags: [],
        ttl: "1 minute",
        value: null,
      });

      expect(
        yield* readStoreEntry({ parts, schema: Schema.NullOr(Schema.String) })
      ).toStrictEqual(Option.some(null));
    })
  );

  it.effect("treats a stored value that no longer decodes as a miss", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts,
        schema: Schema.Finite,
        tags: [],
        ttl: "1 minute",
        value: 1,
      });
      testRuntimeCache.set(
        lastKey(),
        { value: "not a number" },
        {
          expiresAt: Number.MAX_SAFE_INTEGER,
          now: 0,
          tags: [],
        }
      );

      expect(
        yield* readStoreEntry({ parts, schema: Schema.Finite })
      ).toStrictEqual(Option.none());
    })
  );

  it.effect("leaves a value uncached when the schema cannot encode it", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts,
        schema: Schema.Finite,
        tags: [],
        ttl: "1 minute",
        value: Number.NaN,
      });

      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("does not keep a value over the entry limit", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts,
        schema: TextSchema,
        tags: [],
        ttl: "1 minute",
        value: "x".repeat(2_000_001),
      });

      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("drops every entry that carries one tag and no other", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        parts: ["a"],
        schema: TextSchema,
        tags: ["one"],
        ttl: "1 minute",
        value: "a",
      });
      yield* writeStoreEntry({
        parts: ["b"],
        schema: TextSchema,
        tags: ["two"],
        ttl: "1 minute",
        value: "b",
      });

      yield* expireStoreTag("one");

      expect(
        yield* readStoreEntry({ parts: ["a"], schema: TextSchema })
      ).toStrictEqual(Option.none());
      expect(
        yield* readStoreEntry({ parts: ["b"], schema: TextSchema })
      ).toStrictEqual(Option.some("b"));
    })
  );
});
