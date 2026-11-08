// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Layer } from "effect";
import {
  queryContentStore,
  queryPinnedContentStore,
  querySnapshotContentStore,
} from "@/lib/content/store/query";
import {
  resetTestRuntimeCache,
  STORE_KEY_PATTERN,
  testRuntimeCache,
} from "@/test/store";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const activeMocks = vi.hoisted(() => ({
  expire: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: fetchQueryMock };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

vi.mock("@/lib/content/store/memory", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { makeMemoryStore: () => cache };
});

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const identity = {
  manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  releaseId: ReleaseIdSchema.make("release-a"),
  sequence: 1,
  snapshots: {
    assessment: null,
    program: Sha256HashSchema.make(`sha256:${"1".repeat(64)}`),
    quran: null,
  },
};
const pinned = ReleaseIdSchema.make("release-pinned");
const catalog = {
  activeReleaseId: "release-a",
  managed: true,
  projectionJson: ["{}"],
};

beforeEach(() => {
  resetTestRuntimeCache();
  fetchQueryMock.mockReset();
  activeMocks.read.mockReset().mockReturnValue(Effect.succeed(identity));
  activeMocks.load.mockReset().mockReturnValue(Effect.succeed(identity));
  activeMocks.expire.mockReset().mockReturnValue(Effect.void);
});

describe("content store query", () => {
  it.effect("reaches Convex once for one query and one release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(catalog));

      expect(yield* queryContentStore(contentRelease.page.catalog)).toEqual(
        catalog
      );
      fetchQueryMock.mockReturnValue(
        Effect.succeed({ ...catalog, managed: false })
      );
      expect(yield* queryContentStore(contentRelease.page.catalog)).toEqual(
        catalog
      );

      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
      expect(fetchQueryMock).toHaveBeenCalledWith(contentRelease.page.catalog);
    })
  );

  it.effect("keys the entry by the function name and every argument", () =>
    Effect.gen(function* () {
      const found = { activeReleaseId: "release-a", kind: "missing" } as const;
      fetchQueryMock.mockReturnValue(Effect.succeed(found));
      const args = {
        appLocale: "en",
        family: "material",
        publicPath: "a",
      } as const;

      yield* queryContentStore(contentRelease.ownership.resolve, args);
      yield* queryContentStore(contentRelease.ownership.resolve, args);
      yield* queryContentStore(contentRelease.ownership.resolve, {
        ...args,
        publicPath: "b",
      });
      yield* queryContentStore(contentRelease.ownership.resolve, {
        ...args,
        family: "article",
      });

      expect(fetchQueryMock).toHaveBeenCalledTimes(3);
      expect(testRuntimeCache.set).toHaveBeenCalledWith(
        expect.stringMatching(STORE_KEY_PATTERN),
        { value: found },
        expect.objectContaining({ tags: [expect.any(String)] })
      );
    })
  );

  it.effect("reaches Convex again under the next release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(catalog));
      yield* queryContentStore(contentRelease.page.catalog);

      const next = {
        ...identity,
        releaseId: ReleaseIdSchema.make("release-b"),
      };
      activeMocks.read.mockReturnValue(Effect.succeed(next));
      activeMocks.load.mockReturnValue(Effect.succeed(next));
      yield* queryContentStore(contentRelease.page.catalog);

      expect(fetchQueryMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("keeps the typed failure of the query and stores nothing", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.fail("convex down"));

      expect(
        yield* queryContentStore(contentRelease.page.catalog).pipe(Effect.flip)
      ).toBe("convex down");
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("keys a pinned read by its pin, never by the stored pointer", () =>
    Effect.gen(function* () {
      const pinnedIdentity = { ...identity, releaseId: pinned };
      activeMocks.load.mockReturnValue(Effect.succeed(pinnedIdentity));
      fetchQueryMock.mockReturnValue(Effect.succeed(catalog));

      yield* queryPinnedContentStore(pinned, contentRelease.page.catalog, {});
      yield* queryPinnedContentStore(pinned, contentRelease.page.catalog, {});

      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
      expect(activeMocks.read).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses a pinned read once Convex names another release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(catalog));

      expect(
        yield* queryPinnedContentStore(
          pinned,
          contentRelease.page.catalog,
          {}
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: identity.releaseId,
        expectedReleaseId: pinned,
      });
      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
      expect(testRuntimeCache.set).not.toHaveBeenCalled();
    })
  );

  it.effect("follows the active release when the caller holds none", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(catalog));

      yield* queryPinnedContentStore(undefined, contentRelease.page.catalog);
      yield* queryContentStore(contentRelease.page.catalog);

      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
      expect(activeMocks.read).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "reaches Convex once for a family's query while releases keep its snapshot",
    () =>
      Effect.gen(function* () {
        const path = { managed: true, routeJson: null };
        fetchQueryMock.mockReturnValue(Effect.succeed(path));
        const args = { appLocale: "en", publicPath: "curriculum/a" } as const;

        yield* querySnapshotContentStore(
          "program",
          contentRelease.program.path,
          args
        );
        const next = {
          ...identity,
          releaseId: ReleaseIdSchema.make("release-b"),
        };
        activeMocks.read.mockReturnValue(Effect.succeed(next));
        activeMocks.load.mockReturnValue(Effect.succeed(next));
        yield* querySnapshotContentStore(
          "program",
          contentRelease.program.path,
          args
        );

        expect(fetchQueryMock).toHaveBeenCalledExactlyOnceWith(
          contentRelease.program.path,
          args
        );
      })
  );
});
