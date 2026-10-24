// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  Deferred,
  Duration,
  Effect,
  Fiber,
  MutableHashMap,
  Record as Rec,
  Schema,
} from "effect";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import { readContentStore } from "@/lib/content/store/read";
import {
  resetTestRuntimeCache,
  STORE_KEY_PATTERN,
  testRuntimeCache,
} from "@/test/store";

const activeMocks = vi.hoisted(() => ({
  expire: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { getCache: () => cache };
});

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const TextSchema = Schema.String;

/** An active identity for one release id. */
const identityOf = (releaseId: string) => ({
  manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  releaseId: ReleaseIdSchema.make(releaseId),
  sequence: 1,
});

/** Makes the pointer and Convex agree that one release is active. */
const activate = (releaseId: string) => {
  activeMocks.read.mockReturnValue(Effect.succeed(identityOf(releaseId)));
  activeMocks.load.mockReturnValue(Effect.succeed(identityOf(releaseId)));
};

/** A loader that counts its runs and yields the next numbered text. */
const makeLoader = () => {
  let runs = 0;
  return vi.fn(() => {
    runs += 1;
    return Effect.succeed(`loaded ${runs}`);
  });
};

const input = (load: ReturnType<typeof makeLoader>) => ({
  kind: "page.catalog",
  load: Effect.suspend(load),
  parts: ["en"],
  schema: TextSchema,
});

/**
 * Lets the reads of a test go on until the store has been asked the given
 * number of times and they have reached the load or the wait that follows. A
 * read that starts a load asks twice, once before and once after it claims the
 * key, and a read that waits for a load asks once before it waits.
 */
const settle = Effect.fn("www.content.store.test.settle")(function* (
  storeReads: number
) {
  yield* Effect.promise(() =>
    vi.waitFor(() =>
      expect(testRuntimeCache.get).toHaveBeenCalledTimes(storeReads)
    )
  );
  yield* Effect.sleep("20 millis");
});

beforeEach(() => {
  resetTestRuntimeCache();
  for (const mock of Rec.values(activeMocks)) {
    mock.mockReset();
  }
  activeMocks.expire.mockReturnValue(Effect.void);
  activate("release-a");
});

describe("content store", () => {
  it.effect(
    "loads a key once and answers every later read from the store",
    () =>
      Effect.gen(function* () {
        const load = makeLoader();

        expect(yield* readContentStore(input(load))).toBe("loaded 1");
        expect(yield* readContentStore(input(load))).toBe("loaded 1");
        expect(yield* readContentStore(input(load))).toBe("loaded 1");

        expect(load).toHaveBeenCalledTimes(1);
      })
  );

  it.effect("loads again under a new release and keeps the old entry", () =>
    Effect.gen(function* () {
      const load = makeLoader();
      expect(yield* readContentStore(input(load))).toBe("loaded 1");

      activate("release-b");
      expect(yield* readContentStore(input(load))).toBe("loaded 2");
      expect(yield* readContentStore(input(load))).toBe("loaded 2");

      activate("release-a");
      expect(yield* readContentStore(input(load))).toBe("loaded 1");
      expect(load).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "keys by a release that the caller proved and skips the pointer",
    () =>
      Effect.gen(function* () {
        const load = makeLoader();
        activeMocks.load.mockReturnValue(
          Effect.succeed(identityOf("release-b"))
        );
        const named = {
          ...input(load),
          release: ReleaseIdSchema.make("release-b"),
        };

        expect(yield* readContentStore(named)).toBe("loaded 1");
        expect(yield* readContentStore(named)).toBe("loaded 1");

        expect(activeMocks.read).not.toHaveBeenCalled();
        expect(load).toHaveBeenCalledTimes(1);
        expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          { value: "loaded 1" },
          expect.objectContaining({ tags: ["content-release:release-b"] })
        );
      })
  );

  it.effect("keeps kinds and parts apart", () =>
    Effect.gen(function* () {
      const load = makeLoader();
      yield* readContentStore(input(load));
      yield* readContentStore({ ...input(load), parts: ["id"] });
      yield* readContentStore({ ...input(load), kind: "article.categories" });

      expect(load).toHaveBeenCalledTimes(3);
    })
  );

  it.effect("loads again when the stored value does not decode", () =>
    Effect.gen(function* () {
      const load = makeLoader();
      yield* readContentStore({
        ...input(load),
        load: Effect.succeed(7),
        schema: Schema.Finite,
      });

      expect(yield* readContentStore(input(load))).toBe("loaded 1");
      expect(yield* readContentStore(input(load))).toBe("loaded 1");
      expect(load).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("stores the value under the tag of its release for 30 days", () =>
    Effect.gen(function* () {
      yield* readContentStore(input(makeLoader()));

      expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(STORE_KEY_PATTERN),
        { value: "loaded 1" },
        {
          name: "page.catalog",
          tags: ["content-release:release-a"],
          ttl: Duration.toSeconds(Duration.days(30)),
        }
      );
    })
  );

  it.effect(
    "starts over under the active release when the stored pointer was stale",
    () =>
      Effect.gen(function* () {
        // The pointer still names release-a while Convex already names
        // release-b, so the first load is not stored under release-a.
        activeMocks.load.mockReturnValue(
          Effect.succeed(identityOf("release-b"))
        );
        const load = makeLoader();

        expect(yield* readContentStore(input(load))).toBe("loaded 2");

        expect(load).toHaveBeenCalledTimes(2);
        expect(activeMocks.expire).toHaveBeenCalledTimes(1);
        expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          { value: "loaded 2" },
          expect.objectContaining({ tags: ["content-release:release-b"] })
        );
      })
  );

  it.effect("fails when the release moves again during the second try", () =>
    Effect.gen(function* () {
      activeMocks.load
        .mockReturnValueOnce(Effect.succeed(identityOf("release-b")))
        .mockReturnValueOnce(Effect.succeed(identityOf("release-c")));

      const failure = yield* readContentStore(input(makeLoader())).pipe(
        Effect.flip
      );

      expect(failure).toEqual(
        new PublishedReleaseMismatchError({
          actualReleaseId: ReleaseIdSchema.make("release-c"),
          expectedReleaseId: ReleaseIdSchema.make("release-b"),
        })
      );
      expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
    })
  );

  it.effect("never moves a release that the caller proved to another", () =>
    Effect.gen(function* () {
      activeMocks.load.mockReturnValue(Effect.succeed(identityOf("release-b")));
      const load = makeLoader();

      const failure = yield* readContentStore({
        ...input(load),
        release: ReleaseIdSchema.make("release-a"),
      }).pipe(Effect.flip);

      expect(failure).toEqual(
        new PublishedReleaseMismatchError({
          actualReleaseId: ReleaseIdSchema.make("release-b"),
          expectedReleaseId: ReleaseIdSchema.make("release-a"),
        })
      );
      expect(load).toHaveBeenCalledTimes(1);
      expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
    })
  );

  it.effect("fails the same way when no release is active any more", () =>
    Effect.gen(function* () {
      activeMocks.load.mockReturnValue(Effect.succeed(null));
      activeMocks.expire.mockReturnValue(Effect.fail("offline"));

      const failure = yield* readContentStore(input(makeLoader())).pipe(
        Effect.flip
      );

      expect(failure).toEqual(
        new PublishedReleaseMismatchError({
          actualReleaseId: null,
          expectedReleaseId: ReleaseIdSchema.make("release-a"),
        })
      );
    })
  );

  it.effect("loads without storing while no release is active", () =>
    Effect.gen(function* () {
      activeMocks.read.mockReturnValue(Effect.succeed(null));
      const load = makeLoader();

      expect(yield* readContentStore(input(load))).toBe("loaded 1");
      expect(yield* readContentStore(input(load))).toBe("loaded 2");

      expect(testRuntimeCache.get).not.toHaveBeenCalled();
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "keeps the error of a load that fails under the active release",
    () =>
      Effect.gen(function* () {
        const failure = yield* readContentStore({
          ...input(makeLoader()),
          load: Effect.fail("source down"),
        }).pipe(Effect.flip);

        expect(failure).toBe("source down");
        expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
        expect(activeMocks.load).toHaveBeenCalledTimes(1);
        expect(activeMocks.expire).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "drops the pointer and keeps the error of a load that fails after the release moved",
    () =>
      Effect.gen(function* () {
        // The pointer names release-a while Convex names release-b, so a read
        // that Convex refuses for the release it was asked about fails.
        activeMocks.load.mockReturnValue(
          Effect.succeed(identityOf("release-b"))
        );
        const load = vi.fn(() => Effect.fail("release moved"));

        const failure = yield* readContentStore({
          ...input(makeLoader()),
          load: Effect.suspend(load),
        }).pipe(Effect.flip);

        expect(failure).toBe("release moved");
        expect(load).toHaveBeenCalledTimes(1);
        expect(activeMocks.expire).toHaveBeenCalledTimes(1);
        expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
      })
  );

  it.effect(
    "reads under the active release once a failed load dropped the pointer",
    () =>
      Effect.gen(function* () {
        let pointer = "release-a";
        activeMocks.read.mockImplementation(() =>
          Effect.succeed(identityOf(pointer))
        );
        activeMocks.expire.mockImplementation(() =>
          Effect.sync(() => {
            pointer = "release-b";
          })
        );
        activeMocks.load.mockReturnValue(
          Effect.succeed(identityOf("release-b"))
        );

        yield* readContentStore({
          ...input(makeLoader()),
          load: Effect.fail("release moved"),
        }).pipe(Effect.flip);

        expect(yield* readContentStore(input(makeLoader()))).toBe("loaded 1");
        expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
          expect.any(String),
          { value: "loaded 1" },
          expect.objectContaining({ tags: ["content-release:release-b"] })
        );
      })
  );

  it.effect(
    "returns the loaded value without storing it when the release cannot be checked",
    () =>
      Effect.gen(function* () {
        activeMocks.load.mockReturnValue(Effect.fail("convex offline"));
        const load = makeLoader();

        expect(yield* readContentStore(input(load))).toBe("loaded 1");
        expect(yield* readContentStore(input(load))).toBe("loaded 2");

        expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
        expect(activeMocks.expire).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "keeps the error of a failed load when the release cannot be checked either",
    () =>
      Effect.gen(function* () {
        activeMocks.load.mockReturnValue(Effect.fail("convex offline"));

        const failure = yield* readContentStore({
          ...input(makeLoader()),
          load: Effect.fail("source down"),
        }).pipe(Effect.flip);

        expect(failure).toBe("source down");
      })
  );

  it.effect("still answers when the store itself is down", () =>
    Effect.gen(function* () {
      testRuntimeCache.get
        .mockRejectedValueOnce(new Error("offline"))
        .mockRejectedValueOnce(new Error("offline"));
      testRuntimeCache.set
        .mockRejectedValueOnce(new Error("offline"))
        .mockRejectedValueOnce(new Error("offline"));
      const load = makeLoader();

      expect(yield* readContentStore(input(load))).toBe("loaded 1");
      expect(yield* readContentStore(input(load))).toBe("loaded 2");
    })
  );

  it.live("shares one load among misses of one key that overlap", () =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      const load = vi.fn(() => Deferred.await(gate).pipe(Effect.as("loaded")));

      const first = yield* Effect.forkChild(readContentStore(input(load)));
      yield* settle(2);
      const second = yield* Effect.forkChild(readContentStore(input(load)));
      yield* settle(3);
      yield* Deferred.succeed(gate, undefined);

      expect(yield* Fiber.join(first)).toBe("loaded");
      expect(yield* Fiber.join(second)).toBe("loaded");
      expect(load).toHaveBeenCalledTimes(1);
      expect(activeMocks.load).toHaveBeenCalledTimes(1);
      expect(testRuntimeCache.set).toHaveBeenCalledTimes(1);
    })
  );

  it.live(
    "lets a waiting read load on its own when the load it waited for failed",
    () =>
      Effect.gen(function* () {
        const gate = yield* Deferred.make<void>();
        const failing = vi.fn(() =>
          Deferred.await(gate).pipe(Effect.andThen(Effect.fail("source down")))
        );
        const own = makeLoader();

        const first = yield* Effect.forkChild(
          readContentStore({
            ...input(makeLoader()),
            load: Effect.suspend(failing),
          }).pipe(Effect.flip)
        );
        yield* settle(2);
        const second = yield* Effect.forkChild(readContentStore(input(own)));
        yield* settle(3);
        yield* Deferred.succeed(gate, undefined);

        expect(yield* Fiber.join(first)).toBe("source down");
        expect(yield* Fiber.join(second)).toBe("loaded 1");
        expect(failing).toHaveBeenCalledTimes(1);
        expect(own).toHaveBeenCalledTimes(1);
      })
  );

  it.live(
    "does not leave a waiting read hanging when the load it waited for is interrupted",
    () =>
      Effect.gen(function* () {
        const own = makeLoader();

        const first = yield* Effect.forkChild(
          readContentStore({
            ...input(makeLoader()),
            load: Effect.never,
          })
        );
        yield* settle(2);
        const second = yield* Effect.forkChild(readContentStore(input(own)));
        yield* settle(3);
        yield* Fiber.interrupt(first);

        expect(yield* Fiber.join(second)).toBe("loaded 1");
      })
  );

  it.effect(
    "does not load again when a load stored the value after the first read missed",
    () =>
      Effect.gen(function* () {
        yield* readContentStore(input(makeLoader()));
        // The read below asked the store while the first load was still
        // writing, so its first answer is a miss although the value is there.
        testRuntimeCache.get.mockResolvedValueOnce(null);
        const own = makeLoader();

        expect(yield* readContentStore(input(own))).toBe("loaded 1");
        expect(own).not.toHaveBeenCalled();
      })
  );
});
