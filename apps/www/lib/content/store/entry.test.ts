// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Duration, Effect, MutableHashMap, Option, Schema } from "effect";
import {
  ContentStoreUnavailableError,
  expireStoreTag,
  readStoreEntry,
  writeStoreEntry,
} from "@/lib/content/store/entry";
import {
  resetTestRuntimeCache,
  STORE_KEY_PATTERN,
  testRuntimeCache,
} from "@/test/store";

const getCacheMock = vi.hoisted(() => vi.fn());
const digestMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { getCache: getCacheMock.mockReturnValue(cache) };
});

vi.mock("@repo/utilities/digest", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@repo/utilities/digest")>();
  digestMock.mockImplementation(original.sha256Hex);
  return { ...original, sha256Hex: digestMock };
});

/** The options that the module handed to `getCache` when it loaded. */
const cacheOptions = getCacheMock.mock.calls[0]?.[0];
const NullableTextSchema = Schema.NullOr(Schema.String);

beforeEach(() => {
  resetTestRuntimeCache();
  digestMock.mockClear();
});

describe("content store entries", () => {
  it("opens the Runtime Cache under its own namespace with unhashed keys", () => {
    expect(cacheOptions?.namespace).toBe("content");
    expect(cacheOptions?.keyHashFunction("already-digested")).toBe(
      "already-digested"
    );
  });

  it.effect("stores a value under an opaque digest of its parts", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        name: "content.test",
        parts: ["release-a", "page.catalog"],
        schema: Schema.String,
        tags: ["content-release:release-a"],
        ttl: Duration.days(30),
        value: "stored text",
      });

      expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(STORE_KEY_PATTERN),
        { value: "stored text" },
        {
          name: "content.test",
          tags: ["content-release:release-a"],
          ttl: 2_592_000,
        }
      );
      const key = testRuntimeCache.set.mock.calls[0]?.[0];
      expect(key).not.toContain("release-a");
      expect(
        yield* readStoreEntry({
          parts: ["release-a", "page.catalog"],
          schema: Schema.String,
        })
      ).toEqual(Option.some("stored text"));
      expect(testRuntimeCache.get).toHaveBeenCalledExactlyOnceWith(key);
    })
  );

  it.effect("keeps different parts apart", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        name: "content.test",
        parts: ["release-a", "page.catalog"],
        schema: Schema.String,
        tags: [],
        ttl: Duration.days(1),
        value: "first",
      });

      for (const parts of [
        ["release-b", "page.catalog"],
        ["release-a", "page.catalog", "en"],
        ["release-a", "article.categories"],
      ]) {
        expect(yield* readStoreEntry({ parts, schema: Schema.String })).toEqual(
          Option.none()
        );
      }
    })
  );

  it.effect("tells a stored null from a miss", () =>
    Effect.gen(function* () {
      expect(
        yield* readStoreEntry({
          parts: ["active"],
          schema: NullableTextSchema,
        })
      ).toEqual(Option.none());

      yield* writeStoreEntry({
        name: "content.test",
        parts: ["active"],
        schema: NullableTextSchema,
        tags: [],
        ttl: Duration.seconds(60),
        value: null,
      });

      expect(
        yield* readStoreEntry({
          parts: ["active"],
          schema: NullableTextSchema,
        })
      ).toEqual(Option.some(null));
    })
  );

  it.effect("treats a stored value that no longer decodes as a miss", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        name: "content.test",
        parts: ["release-a", "page.catalog"],
        schema: Schema.Finite,
        tags: [],
        ttl: Duration.days(1),
        value: 7,
      });

      expect(
        yield* readStoreEntry({
          parts: ["release-a", "page.catalog"],
          schema: Schema.String,
        })
      ).toEqual(Option.none());
    })
  );

  it.effect("treats a store that cannot be read as a miss", () =>
    Effect.gen(function* () {
      testRuntimeCache.get.mockRejectedValueOnce(new Error("offline"));

      expect(
        yield* readStoreEntry({ parts: ["x"], schema: Schema.String })
      ).toEqual(Option.none());
    })
  );

  it.effect("treats a key that cannot be digested as a miss and no write", () =>
    Effect.gen(function* () {
      digestMock.mockReturnValueOnce(Effect.fail("no crypto"));
      expect(
        yield* readStoreEntry({ parts: ["x"], schema: Schema.String })
      ).toEqual(Option.none());

      digestMock.mockReturnValueOnce(Effect.fail("no crypto"));
      yield* writeStoreEntry({
        name: "content.test",
        parts: ["x"],
        schema: Schema.String,
        tags: [],
        ttl: Duration.days(1),
        value: "lost",
      });

      expect(testRuntimeCache.get).not.toHaveBeenCalled();
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("lets a failed write leave the value uncached", () =>
    Effect.gen(function* () {
      testRuntimeCache.set.mockRejectedValueOnce(new Error("offline"));

      yield* writeStoreEntry({
        name: "content.test",
        parts: ["x"],
        schema: Schema.String,
        tags: [],
        ttl: Duration.days(1),
        value: "lost",
      });

      expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
    })
  );

  it.effect("does not store a value that its schema cannot encode", () =>
    Effect.gen(function* () {
      yield* writeStoreEntry({
        name: "content.test",
        parts: ["x"],
        schema: Schema.Finite,
        tags: [],
        ttl: Duration.days(1),
        value: Number.NaN,
      });

      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("expires every entry that carries a tag and no other", () =>
    Effect.gen(function* () {
      for (const [parts, tag] of [
        [["a"], "content-release:release-a"],
        [["b"], "content-release:release-a"],
        [["c"], "content-release:release-b"],
      ] as const) {
        yield* writeStoreEntry({
          name: "content.test",
          parts,
          schema: Schema.String,
          tags: [tag],
          ttl: Duration.days(1),
          value: "kept",
        });
      }

      yield* expireStoreTag("content-release:release-a");

      expect(testRuntimeCache.expireTag).toHaveBeenCalledExactlyOnceWith(
        "content-release:release-a"
      );
      expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(1);
    })
  );

  it.effect("fails an expiry that the client could not send", () =>
    Effect.gen(function* () {
      const cause = new Error("offline");
      testRuntimeCache.expireTag.mockRejectedValueOnce(cause);

      expect(yield* expireStoreTag("content-active").pipe(Effect.flip)).toEqual(
        new ContentStoreUnavailableError({ cause, operation: "expire" })
      );
    })
  );
});
