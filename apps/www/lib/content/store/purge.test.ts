// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { purgeOncePerRelease } from "@/lib/content/store/purge";
import { resetTestRuntimeCache } from "@/test/store";

const activeMocks = vi.hoisted(() => ({
  expire: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
}));

vi.mock(
  "@vercel/functions",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const releaseId = ReleaseIdSchema.make("release-purge");
const nextReleaseId = ReleaseIdSchema.make("release-next");

/** The active identity that Convex answers while one release is active. */
const identityOf = (id: typeof releaseId) => ({
  manifestHash: `sha256:${"a".repeat(64)}`,
  releaseId: id,
  sequence: 1,
});

describe("purge once for each release", () => {
  /** Stands for the CDN call: each run of the purge below calls it once. */
  const run = vi.fn<() => Effect.Effect<void, string>>();
  const purge = Effect.suspend(run);
  const once = (kind: string, id: typeof releaseId) =>
    purgeOncePerRelease({ kind, purge, releaseId: id });

  beforeEach(() => {
    run.mockReset().mockReturnValue(Effect.void);
    activeMocks.load
      .mockReset()
      .mockReturnValue(Effect.succeed(identityOf(releaseId)));
    activeMocks.read
      .mockReset()
      .mockReturnValue(Effect.succeed(identityOf(releaseId)));
    resetTestRuntimeCache();
  });

  it.effect("purges once however many times the release asks", () =>
    Effect.gen(function* () {
      yield* once("test.purge", releaseId);
      yield* once("test.purge", releaseId);
      yield* once("test.purge", releaseId);

      expect(run).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("purges again for the next release", () =>
    Effect.gen(function* () {
      yield* once("test.purge", releaseId);

      activeMocks.load.mockReturnValue(
        Effect.succeed(identityOf(nextReleaseId))
      );
      yield* once("test.purge", nextReleaseId);
      yield* once("test.purge", nextReleaseId);

      expect(run).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("keeps the proof of one kind apart from another", () =>
    Effect.gen(function* () {
      yield* once("first.purge", releaseId);
      yield* once("second.purge", releaseId);

      expect(run).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("files the proof under the named release, not the pointer's", () =>
    Effect.gen(function* () {
      activeMocks.read.mockReturnValue(
        Effect.succeed(identityOf(nextReleaseId))
      );

      yield* once("test.purge", releaseId);
      yield* once("test.purge", releaseId);

      expect(activeMocks.read).not.toHaveBeenCalled();
      expect(run).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "keeps a failed purge in the error channel and purges again on retry",
    () =>
      Effect.gen(function* () {
        run.mockReturnValueOnce(Effect.fail("offline"));

        const error = yield* once("test.purge", releaseId).pipe(Effect.flip);
        yield* once("test.purge", releaseId);

        expect(error).toBe("offline");
        expect(run).toHaveBeenCalledTimes(2);
      })
  );
});
