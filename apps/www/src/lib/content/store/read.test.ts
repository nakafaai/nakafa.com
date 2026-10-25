// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Data, Effect, Record as Rec, Schema } from "effect";
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

vi.mock("@/lib/content/store/memory", async () => {
  const { testRuntimeCacheModule } = await import("@/test/store");
  return testRuntimeCacheModule;
});

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const TextSchema = Schema.String;

/** The release check could not reach Convex. */
class ConvexDownError extends Data.TaggedError("ConvexDownError") {}

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

beforeEach(() => {
  resetTestRuntimeCache();
  for (const mock of Rec.values(activeMocks)) {
    mock.mockReset();
  }
  activeMocks.expire.mockReturnValue(Effect.void);
  activate("release-a");
});

describe("content store reads", () => {
  it.effect(
    "loads once and answers later reads of the release from the store",
    () =>
      Effect.gen(function* () {
        const load = makeLoader();

        expect(yield* readContentStore(input(load))).toBe("loaded 1");
        expect(yield* readContentStore(input(load))).toBe("loaded 1");
        expect(load).toHaveBeenCalledTimes(1);
      })
  );

  it.effect("loads again under a new release and keeps the old entry", () =>
    Effect.gen(function* () {
      const load = makeLoader();
      yield* readContentStore(input(load));

      activate("release-b");

      expect(yield* readContentStore(input(load))).toBe("loaded 2");
      expect(load).toHaveBeenCalledTimes(2);
    })
  );

  it.live("never shares a load between two requests for one key", () =>
    Effect.gen(function* () {
      const load = vi.fn(() =>
        Effect.sleep("10 millis").pipe(Effect.as("loaded"))
      );
      const read = () =>
        readContentStore({
          kind: "page.catalog",
          load: Effect.suspend(load),
          parts: ["en"],
          schema: TextSchema,
        });

      yield* Effect.all([read(), read()], { concurrency: "unbounded" });

      expect(load).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("stores the value under the tag of its release", () =>
    Effect.gen(function* () {
      yield* readContentStore(input(makeLoader()));

      expect(testRuntimeCache.set).toHaveBeenCalledWith(
        expect.stringMatching(STORE_KEY_PATTERN),
        expect.anything(),
        expect.objectContaining({ tags: ["content-release:release-a"] })
      );
    })
  );

  it.effect("loads again when the stored value does not decode", () =>
    Effect.gen(function* () {
      yield* readContentStore({
        kind: "page.catalog",
        load: Effect.succeed("text"),
        parts: ["en"],
        schema: TextSchema,
      });
      const numbers = vi.fn(() => Effect.succeed(7));

      expect(
        yield* readContentStore({
          kind: "page.catalog",
          load: Effect.suspend(numbers),
          parts: ["en"],
          schema: Schema.Finite,
        })
      ).toBe(7);
      expect(numbers).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "reads the release that is active now when the release moved during the load",
    () =>
      Effect.gen(function* () {
        activeMocks.load.mockReturnValueOnce(
          Effect.succeed(identityOf("release-b"))
        );
        activeMocks.load.mockReturnValue(
          Effect.succeed(identityOf("release-b"))
        );
        const load = makeLoader();

        expect(yield* readContentStore(input(load))).toBe("loaded 2");
        expect(activeMocks.expire).toHaveBeenCalled();
      })
  );

  it.effect("fails when the release moves again during the second try", () =>
    Effect.gen(function* () {
      activeMocks.load
        .mockReturnValueOnce(Effect.succeed(identityOf("release-b")))
        .mockReturnValueOnce(Effect.succeed(identityOf("release-c")));
      activeMocks.load.mockReturnValue(Effect.succeed(identityOf("release-c")));

      const error = yield* Effect.flip(readContentStore(input(makeLoader())));

      expect(error).toBeInstanceOf(PublishedReleaseMismatchError);
    })
  );

  it.effect("never moves a release that the caller proved to another", () =>
    Effect.gen(function* () {
      activeMocks.load.mockReturnValue(Effect.succeed(identityOf("release-b")));

      const error = yield* Effect.flip(
        readContentStore({
          ...input(makeLoader()),
          release: ReleaseIdSchema.make("release-a"),
        })
      );

      expect(error).toBeInstanceOf(PublishedReleaseMismatchError);
    })
  );

  it.effect(
    "fails with a mismatch when no release is active after the load",
    () =>
      Effect.gen(function* () {
        activeMocks.load.mockReturnValue(Effect.succeed(null));

        const error = yield* Effect.flip(readContentStore(input(makeLoader())));

        expect(error).toBeInstanceOf(PublishedReleaseMismatchError);
      })
  );

  it.effect("loads without storing while no release is active", () =>
    Effect.gen(function* () {
      activeMocks.read.mockReturnValue(Effect.succeed(null));
      const load = makeLoader();

      yield* readContentStore(input(load));
      yield* readContentStore(input(load));

      expect(load).toHaveBeenCalledTimes(2);
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("answers the load when the release check itself fails", () =>
    Effect.gen(function* () {
      activeMocks.load.mockReturnValue(Effect.fail(new ConvexDownError()));

      expect(yield* readContentStore(input(makeLoader()))).toBe("loaded 1");
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("keeps the load's own error when the release still holds", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readContentStore({
          kind: "page.catalog",
          load: Effect.fail("boom"),
          parts: ["en"],
          schema: TextSchema,
        })
      );

      expect(error).toBe("boom");
    })
  );

  it.effect(
    "fails with the load's own error and drops the pointer when the release moved",
    () =>
      Effect.gen(function* () {
        activeMocks.load.mockReturnValue(
          Effect.succeed(identityOf("release-b"))
        );

        const error = yield* Effect.flip(
          readContentStore({
            kind: "page.catalog",
            load: Effect.fail("boom"),
            parts: ["en"],
            schema: TextSchema,
          })
        );

        expect(error).toBe("boom");
        expect(activeMocks.expire).toHaveBeenCalled();
      })
  );
});
