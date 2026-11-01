// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Data, Effect, Option, Schema } from "effect";
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

/** The digest of a key failed, as Effect's digest does: it dies. */
class DigestUnavailableError extends Data.TaggedError(
  "DigestUnavailableError"
) {}

/** Makes the digest of a key fail on demand. */
const digest = vi.hoisted(() => ({ fails: false }));

vi.mock("@repo/utilities/digest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/utilities/digest")>();
  return {
    ...actual,
    sha256Hex: (text: string) =>
      digest.fails
        ? Effect.die(new DigestUnavailableError())
        : actual.sha256Hex(text),
  };
});

vi.mock("@/lib/content/store/memory", async () => {
  const { testRuntimeCacheModule } = await import("@/test/store");
  return testRuntimeCacheModule;
});

const { readBuildEntry, writeBuildEntry } = vi.hoisted(() => ({
  readBuildEntry: vi.fn(),
  writeBuildEntry: vi.fn(),
}));

vi.mock("@/lib/content/store/build", () => ({
  readBuildEntry,
  writeBuildEntry,
}));

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
  readBuildEntry.mockReset();
  readBuildEntry.mockReturnValue(Effect.succeedNone);
  writeBuildEntry.mockReset();
  writeBuildEntry.mockReturnValue(Effect.void);
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

  it.effect("asks the deploy's read store for a lasting entry it lacks", () =>
    Effect.gen(function* () {
      readBuildEntry.mockReturnValueOnce(
        Effect.succeedSome({ value: "kept by a deploy" })
      );

      expect(
        yield* readStoreEntry({ lasting: true, parts, schema: TextSchema })
      ).toStrictEqual(Option.some("kept by a deploy"));
    })
  );

  it.effect("keeps the active pointer out of the deploy's read store", () =>
    Effect.gen(function* () {
      yield* readStoreEntry({ parts, schema: TextSchema });
      yield* writeStoreEntry({
        parts,
        schema: TextSchema,
        tags: [],
        ttl: "1 minute",
        value: "text",
      });

      expect(readBuildEntry).not.toHaveBeenCalled();
      expect(writeBuildEntry).not.toHaveBeenCalled();
    })
  );

  it.effect("hands the deploy's read store a lasting entry", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        lasting: true,
        parts,
        schema: TextSchema,
        tags: [],
        ttl: "1 minute",
        value: "text",
      });

      expect(writeBuildEntry).toHaveBeenCalledExactlyOnceWith(lastKey(), {
        value: "text",
      });
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

  it.effect("treats a key that cannot be digested as a miss and no write", () =>
    Effect.gen(function* () {
      digest.fails = true;
      const read = yield* readStoreEntry({ parts, schema: TextSchema });
      yield* writeStoreEntry({
        parts,
        schema: TextSchema,
        tags: [],
        ttl: "1 minute",
        value: "kept",
      });
      digest.fails = false;

      expect(read).toStrictEqual(Option.none());
      expect(testRuntimeCache.get).not.toHaveBeenCalled();
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
