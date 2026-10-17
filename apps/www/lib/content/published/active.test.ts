// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  createTestPublication,
  makeRuntimeSource,
  testPublicationRelease,
} from "@repo/backend/test/content/publication";
import { Effect, Layer, MutableHashMap } from "effect";
import {
  confirmActiveContentIdentity,
  expireActiveContentIdentity,
  loadActiveContentIdentity,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import {
  resetTestRuntimeCache,
  STORE_KEY_PATTERN,
  testRuntimeCache,
} from "@/test/store";

const fetchQueryMock = vi.hoisted(() => vi.fn());
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
            return {
              ...client,
              query: fetchQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { getCache: () => cache };
});
const identity = {
  manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  releaseId: ReleaseIdSchema.make("release-active"),
  sequence: 3,
};
beforeEach(() => {
  fetchQueryMock.mockReset();
  resetTestRuntimeCache();
});
describe("published active identity", () => {
  it.effect(
    "reads the active identity through the native publication query",
    () =>
      Effect.gen(function* () {
        const publication = yield* testPublicationRelease();
        const context = yield* createTestPublication(
          (yield* makeRuntimeSource()).source
        );
        fetchQueryMock.mockImplementation(context.query);
        expect(yield* loadActiveContentIdentity()).toEqual({
          manifestHash: publication.manifestHash,
          releaseId: publication.manifest.releaseId,
          sequence: 9,
        });
      })
  );
  it.effect(
    "reads the exact active release without another state interpretation",
    () =>
      Effect.gen(function* () {
        fetchQueryMock.mockReturnValue(Effect.succeed(identity));
        expect(yield* loadActiveContentIdentity()).toEqual(identity);
        expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), {});
      })
  );
  it.effect("preserves the absence of an active release", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(null));
      expect(yield* loadActiveContentIdentity()).toBeNull();
    })
  );
  it.effect("never answers a load from the store", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(identity));
      yield* loadActiveContentIdentity();
      yield* loadActiveContentIdentity();
      expect(fetchQueryMock).toHaveBeenCalledTimes(2);
      expect(MutableHashMap.size(testRuntimeCache.entries)).toBe(0);
    })
  );
});
describe("stored active identity pointer", () => {
  it.effect("reads Convex once for every read in the pointer lifetime", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(identity));
      expect(yield* readActiveContentIdentity()).toEqual(identity);
      expect(yield* readActiveContentIdentity()).toEqual(identity);
      expect(yield* readActiveContentIdentity()).toEqual(identity);
      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
    })
  );
  it.effect("keeps the pointer for a minute under its own tag", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(identity));
      yield* readActiveContentIdentity();
      expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(STORE_KEY_PATTERN),
        { value: identity },
        { name: "content.active", tags: ["content-active"], ttl: 60 }
      );
    })
  );
  it.effect("stores the absence of a release like any other pointer", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(null));
      expect(yield* readActiveContentIdentity()).toBeNull();
      expect(yield* readActiveContentIdentity()).toBeNull();
      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
    })
  );
  it.effect("reads Convex again once the activation expires the pointer", () =>
    Effect.gen(function* () {
      const next = { ...identity, releaseId: ReleaseIdSchema.make("next") };
      fetchQueryMock.mockReturnValueOnce(Effect.succeed(identity));
      fetchQueryMock.mockReturnValueOnce(Effect.succeed(next));
      expect(yield* readActiveContentIdentity()).toEqual(identity);
      expect(yield* readActiveContentIdentity()).toEqual(identity);

      yield* expireActiveContentIdentity();

      expect(testRuntimeCache.expireTag).toHaveBeenCalledExactlyOnceWith(
        "content-active"
      );
      expect(yield* readActiveContentIdentity()).toEqual(next);
      expect(fetchQueryMock).toHaveBeenCalledTimes(2);
    })
  );
});
describe("confirming the pointer after an activation", () => {
  const next = { ...identity, releaseId: ReleaseIdSchema.make("next") };

  it.effect("accepts a pointer that names the activated release", () =>
    Effect.gen(function* () {
      fetchQueryMock
        .mockReturnValueOnce(Effect.succeed(identity))
        .mockReturnValueOnce(Effect.succeed(next));
      yield* readActiveContentIdentity();

      yield* expireActiveContentIdentity();
      yield* confirmActiveContentIdentity(next.releaseId);

      // The read back stored the fresh pointer for the next reader.
      expect(yield* readActiveContentIdentity()).toEqual(next);
      expect(fetchQueryMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "fails when an expiry that the client lost left the previous release",
    () =>
      Effect.gen(function* () {
        fetchQueryMock.mockReturnValue(Effect.succeed(identity));
        yield* readActiveContentIdentity();
        // The real client logs a failed or timed out expiry and resolves, so the
        // call looks like a success and removes nothing.
        testRuntimeCache.expireTag.mockImplementationOnce(() =>
          Promise.resolve()
        );

        yield* expireActiveContentIdentity();
        const failure = yield* confirmActiveContentIdentity(
          next.releaseId
        ).pipe(Effect.flip);

        expect(failure).toEqual(
          new PublishedReleaseMismatchError({
            actualReleaseId: identity.releaseId,
            expectedReleaseId: next.releaseId,
          })
        );
      })
  );

  it.effect("fails when no release is active", () =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(Effect.succeed(null));

      const failure = yield* confirmActiveContentIdentity(next.releaseId).pipe(
        Effect.flip
      );

      expect(failure).toEqual(
        new PublishedReleaseMismatchError({
          actualReleaseId: null,
          expectedReleaseId: next.releaseId,
        })
      );
    })
  );
});
