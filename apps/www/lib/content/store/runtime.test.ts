// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Duration, Effect, Option } from "effect";
import {
  expireRuntimeCacheTag,
  getRuntimeCacheEntry,
  invalidateRuntimeCacheTag,
  MAX_ITEM_BYTES,
  MAX_ITEM_TAGS,
  MAX_TAG_BYTES,
  RuntimeCacheLimit,
  RuntimeCacheUnavailable,
  readRetryAfter,
  setRuntimeCacheEntry,
} from "@/lib/content/store/runtime";

/** The platform calls that the Runtime Cache and the purge make, as test doubles. */
const platform = vi.hoisted(() => ({
  expireTag: vi.fn<(tag: string) => Promise<void>>(),
  get: vi.fn<(key: string) => Promise<unknown>>(),
  invalidateByTag: vi.fn<(tag: string) => Promise<void>>(),
  set: vi.fn<
    (
      key: string,
      value: unknown,
      options?: { name?: string; tags?: string[]; ttl?: number }
    ) => Promise<void>
  >(),
}));

vi.mock("@vercel/functions", () => ({
  /** The digest function of the cache must reach the platform, so the stub applies it. */
  getCache: (options: {
    keyHashFunction: (key: string) => string;
    namespace: string;
  }) => ({
    delete: vi.fn(),
    expireTag: platform.expireTag,
    get: (key: string) => platform.get(options.keyHashFunction(key)),
    set: (
      key: string,
      value: unknown,
      settings?: { name?: string; tags?: string[]; ttl?: number }
    ) => platform.set(options.keyHashFunction(key), value, settings),
  }),
  invalidateByTag: platform.invalidateByTag,
}));

/** A rate-limit answer from the platform, which names its wait in seconds. */
const rateLimit = (retryAfter?: string) => ({
  headers: retryAfter === undefined ? {} : { "retry-after": retryAfter },
  status: 429,
});

const item = {
  key: "digest",
  name: "article",
  tags: ["content:article"],
  ttl: Duration.seconds(60),
  value: { title: "Aljabar" },
};

describe("runtime cache reads", () => {
  it.effect(
    "returns the stored value of a key, which the cache uses as it is",
    () =>
      Effect.gen(function* () {
        platform.get.mockResolvedValueOnce({ title: "Aljabar" });
        const stored = yield* getRuntimeCacheEntry("digest");
        expect(platform.get).toHaveBeenCalledWith("digest");
        expect(stored).toStrictEqual(Option.some({ title: "Aljabar" }));
      })
  );

  it.effect("answers a miss with none", () =>
    Effect.gen(function* () {
      platform.get.mockResolvedValueOnce(null);
      const stored = yield* getRuntimeCacheEntry("digest");
      expect(stored).toStrictEqual(Option.none());
    })
  );

  it.effect("fails a read that the platform refuses", () =>
    Effect.gen(function* () {
      const cause = new Error("offline");
      platform.get.mockRejectedValueOnce(cause);
      const error = yield* Effect.flip(getRuntimeCacheEntry("digest"));
      expect(error).toEqual(
        new RuntimeCacheUnavailable({ cause, operation: "get" })
      );
    })
  );
});

describe("runtime cache writes", () => {
  it.effect(
    "stores the value with its name, tags and lifetime in seconds",
    () =>
      Effect.gen(function* () {
        platform.set.mockResolvedValueOnce(undefined);
        yield* setRuntimeCacheEntry(item);
        expect(platform.set).toHaveBeenCalledWith("digest", item.value, {
          name: "article",
          tags: ["content:article"],
          ttl: 60,
        });
      })
  );

  it.effect("accepts an item at each limit", () =>
    Effect.gen(function* () {
      platform.set.mockResolvedValueOnce(undefined);
      const tags = Arr.makeBy(MAX_ITEM_TAGS, (index) => `t${index}`);
      yield* setRuntimeCacheEntry({
        ...item,
        tags: Arr.append(Arr.drop(tags, 1), "a".repeat(MAX_TAG_BYTES)),
        value: "x".repeat(MAX_ITEM_BYTES - 2),
      });
      expect(platform.set).toHaveBeenCalledOnce();
    })
  );

  it.effect.each([
    ["tag-comma", ["a,b"], "x"],
    ["tag-count", Arr.makeBy(MAX_ITEM_TAGS + 1, (index) => `t${index}`), "x"],
    ["tag-bytes", ["a".repeat(MAX_TAG_BYTES + 1)], "x"],
    ["tag-bytes", ["é".repeat(MAX_TAG_BYTES / 2 + 1)], "x"],
    ["item-bytes", ["content:article"], "x".repeat(MAX_ITEM_BYTES)],
  ] as const)(
    "refuses a write over the %s limit before the call",
    ([limit, tags, value]) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          setRuntimeCacheEntry({ ...item, tags: [...tags], value })
        );
        expect(error).toEqual(new RuntimeCacheLimit({ limit }));
        expect(platform.set).not.toHaveBeenCalled();
      })
  );

  it.effect("fails a write that the platform refuses", () =>
    Effect.gen(function* () {
      const cause = new Error("full");
      platform.set.mockRejectedValueOnce(cause);
      const error = yield* Effect.flip(setRuntimeCacheEntry(item));
      expect(error).toEqual(
        new RuntimeCacheUnavailable({ cause, operation: "set" })
      );
    })
  );
});

describe("runtime cache purges", () => {
  it.effect("expires a tag once when the platform answers", () =>
    Effect.gen(function* () {
      platform.expireTag.mockResolvedValueOnce(undefined);
      yield* expireRuntimeCacheTag("content:article");
      expect(platform.expireTag).toHaveBeenCalledWith("content:article");
    })
  );

  it.effect("repeats a rate-limited expiry after its wait", () =>
    Effect.gen(function* () {
      platform.expireTag
        .mockRejectedValueOnce(rateLimit("0"))
        .mockResolvedValueOnce(undefined);
      yield* expireRuntimeCacheTag("content:article");
      expect(platform.expireTag).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "repeats a rate-limited invalidation, then fails when the limit holds",
    () =>
      Effect.gen(function* () {
        platform.invalidateByTag.mockRejectedValue(rateLimit("0"));
        const error = yield* Effect.flip(
          invalidateRuntimeCacheTag("content:article")
        );
        expect(error).toEqual(
          new RuntimeCacheUnavailable({
            cause: rateLimit("0"),
            operation: "invalidate",
          })
        );
        expect(platform.invalidateByTag).toHaveBeenCalledTimes(4);
        platform.invalidateByTag.mockReset();
      })
  );

  it.effect("does not repeat a failure that is not a rate limit", () =>
    Effect.gen(function* () {
      const cause = new Error("down");
      platform.invalidateByTag.mockRejectedValueOnce(cause);
      const error = yield* Effect.flip(
        invalidateRuntimeCacheTag("content:article")
      );
      expect(error).toEqual(
        new RuntimeCacheUnavailable({ cause, operation: "invalidate" })
      );
      expect(platform.invalidateByTag).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "fails an expiry that the platform refuses without a rate limit",
    () =>
      Effect.gen(function* () {
        const cause = new Error("refused");
        platform.expireTag.mockRejectedValueOnce(cause);
        const error = yield* Effect.flip(
          expireRuntimeCacheTag("content:article")
        );
        expect(error).toEqual(
          new RuntimeCacheUnavailable({ cause, operation: "expire" })
        );
      })
  );
});

describe("rate-limit waits", () => {
  it.each([
    ["3", 3],
    ["0", 0],
  ])("waits for the retry-after of %s seconds", (value, seconds) => {
    expect(readRetryAfter(rateLimit(value))).toStrictEqual(
      Option.some(Duration.seconds(seconds))
    );
  });

  it.each([undefined, "later", "-1"])(
    "waits for the default when retry-after is %s",
    (value) => {
      expect(readRetryAfter(rateLimit(value))).toStrictEqual(
        Option.some(Duration.seconds(1))
      );
    }
  );

  it("names no wait for a failure that is not a rate limit", () => {
    expect(readRetryAfter(new Error("down"))).toStrictEqual(Option.none());
    expect(readRetryAfter({ headers: {}, status: 500 })).toStrictEqual(
      Option.none()
    );
  });
});
