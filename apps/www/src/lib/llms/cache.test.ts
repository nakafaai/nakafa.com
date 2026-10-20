// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { ContentStoreUnavailableError } from "@/lib/content/store/entry";
import { invalidateLlmsCache } from "@/lib/llms/cache";
import { resetTestRuntimeCache } from "@/test/store";

const invalidateByTagMock = vi.hoisted(() => vi.fn());
const activeMocks = vi.hoisted(() => ({
  expire: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return {
    getCache: () => cache,
    /** Records stale marking without calling Vercel. */
    invalidateByTag: invalidateByTagMock,
  };
});

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const releaseId = ReleaseIdSchema.make("release-llms");
const nextReleaseId = ReleaseIdSchema.make("release-llms-next");

/** The active identity that Convex answers while one release is active. */
const identityOf = (id: typeof releaseId) => ({
  manifestHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  releaseId: id,
  sequence: 1,
});

describe("llms cache invalidation", () => {
  beforeEach(() => {
    invalidateByTagMock.mockReset().mockResolvedValue(undefined);
    activeMocks.load
      .mockReset()
      .mockReturnValue(Effect.succeed(identityOf(releaseId)));
    activeMocks.read
      .mockReset()
      .mockReturnValue(Effect.succeed(identityOf(releaseId)));
    resetTestRuntimeCache();
  });

  it.effect("marks every Markdown answer stale at the CDN", () =>
    Effect.gen(function* () {
      yield* invalidateLlmsCache(releaseId);

      expect(invalidateByTagMock).toHaveBeenCalledExactlyOnceWith(
        "content-llms"
      );
    })
  );

  it.effect("purges once for every release however many times it asks", () =>
    Effect.gen(function* () {
      yield* invalidateLlmsCache(releaseId);
      yield* invalidateLlmsCache(releaseId);

      expect(invalidateByTagMock).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("purges again for the next release", () =>
    Effect.gen(function* () {
      yield* invalidateLlmsCache(releaseId);

      activeMocks.load.mockReturnValue(
        Effect.succeed(identityOf(nextReleaseId))
      );
      yield* invalidateLlmsCache(nextReleaseId);

      expect(invalidateByTagMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("keeps a failed CDN invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));

      const error = yield* invalidateLlmsCache(releaseId).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ContentStoreUnavailableError);
      expect(error).toMatchObject({ operation: "invalidate" });
    })
  );

  it.effect("purges again on the retry of a call that failed", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));
      yield* invalidateLlmsCache(releaseId).pipe(Effect.flip);

      yield* invalidateLlmsCache(releaseId);

      expect(invalidateByTagMock).toHaveBeenCalledTimes(2);
    })
  );
});
