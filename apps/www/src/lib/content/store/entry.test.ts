// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  Duration,
  Effect,
  Fiber,
  MutableHashMap,
  Option,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";
import {
  ContentStoreLimitError,
  ContentStoreUnavailableError,
  expireStoreTag,
  invalidateStoreTag,
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
const invalidateByTagMock = vi.hoisted(() =>
  vi.fn<(tag: string) => Promise<void>>()
);

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return {
    getCache: getCacheMock.mockReturnValue(cache),
    invalidateByTag: invalidateByTagMock,
  };
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
  invalidateByTagMock.mockReset();
  invalidateByTagMock.mockResolvedValue();
});

/** A rate-limit answer from the platform, which names its wait in seconds. */
const rateLimit = (retryAfter?: string) => ({
  headers: retryAfter === undefined ? {} : { "retry-after": retryAfter },
  status: 429,
});

/** Writes one text entry under one tag, with the given value. */
const writeText = (value: string, tags: readonly string[] = ["content:x"]) =>
  writeStoreEntry({
    name: "content.test",
    parts: ["limit"],
    schema: Schema.String,
    tags,
    ttl: Duration.days(1),
    value,
  });

/**
 * Runs one purge while the test clock passes the time its waits take, so a
 * default wait does not block the test.
 */
const expireWithin = (elapsed: Duration.Input) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(expireStoreTag("content:x"));
    yield* TestClock.adjust(elapsed);
    return yield* Fiber.join(fiber);
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

describe("content store limits", () => {
  it.effect(
    "refuses an entry with a tag that holds a comma, and writes nothing",
    () =>
      Effect.gen(function* () {
        yield* writeText("kept", ["content:a,b"]);
        expect(testRuntimeCache.set).not.toHaveBeenCalled();
        expect(
          yield* readStoreEntry({ parts: ["limit"], schema: Schema.String })
        ).toStrictEqual(Option.none());
      })
  );

  it.effect("refuses an entry with more tags than the platform allows", () =>
    Effect.gen(function* () {
      const tags = Array.from(
        { length: 129 },
        (_, index) => `content:${index}`
      );
      yield* writeText("kept", tags);
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses an entry with a tag over 256 bytes", () =>
    Effect.gen(function* () {
      yield* writeText("kept", ["t".repeat(257)]);
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses an entry over 2 MB as JSON", () =>
    Effect.gen(function* () {
      yield* writeText("x".repeat(2_000_000));
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("stores an entry at each limit", () =>
    Effect.gen(function* () {
      const tags = Array.from({ length: 128 }, (_, index) =>
        `${index}`.padEnd(256, "t")
      );
      yield* writeText("kept", tags);
      expect(testRuntimeCache.set).toHaveBeenCalledOnce();
      expect(
        yield* readStoreEntry({ parts: ["limit"], schema: Schema.String })
      ).toStrictEqual(Option.some("kept"));
    })
  );

  it("names each refused limit", () => {
    expect(new ContentStoreLimitError({ limit: "tag-comma" }).limit).toBe(
      "tag-comma"
    );
  });
});

describe("content store purges", () => {
  it.effect("repeats a rate-limited expiry after the wait it names", () =>
    Effect.gen(function* () {
      testRuntimeCache.expireTag
        .mockRejectedValueOnce(rateLimit("0"))
        .mockResolvedValueOnce();
      yield* expireStoreTag("content:x");
      expect(testRuntimeCache.expireTag).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "waits the default second when a rate limit names no usable wait",
    () =>
      Effect.gen(function* () {
        testRuntimeCache.expireTag
          .mockRejectedValueOnce(rateLimit())
          .mockRejectedValueOnce(rateLimit("later"))
          .mockResolvedValue();
        yield* expireWithin("2 seconds");
        expect(testRuntimeCache.expireTag).toHaveBeenCalledTimes(3);
      })
  );

  it.effect("fails with the last rate limit after three repeats", () =>
    Effect.gen(function* () {
      testRuntimeCache.expireTag.mockRejectedValue(rateLimit("0"));
      const error = yield* expireStoreTag("content:x").pipe(Effect.flip);
      expect(error).toStrictEqual(
        new ContentStoreUnavailableError({
          cause: rateLimit("0"),
          operation: "expire",
        })
      );
      expect(testRuntimeCache.expireTag).toHaveBeenCalledTimes(4);
    })
  );

  it.effect("does not repeat an expiry that fails for another reason", () =>
    Effect.gen(function* () {
      testRuntimeCache.expireTag.mockRejectedValueOnce(new Error("offline"));
      yield* expireStoreTag("content:x").pipe(Effect.flip);
      expect(testRuntimeCache.expireTag).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("invalidates a tag on the CDN once", () =>
    Effect.gen(function* () {
      yield* invalidateStoreTag("content:x");
      expect(invalidateByTagMock).toHaveBeenCalledExactlyOnceWith("content:x");
    })
  );

  it.effect("fails an invalidation that the platform refuses", () =>
    Effect.gen(function* () {
      const cause = new Error("offline");
      invalidateByTagMock.mockRejectedValueOnce(cause);
      expect(yield* invalidateStoreTag("content:x").pipe(Effect.flip)).toEqual(
        new ContentStoreUnavailableError({ cause, operation: "invalidate" })
      );
    })
  );
});
