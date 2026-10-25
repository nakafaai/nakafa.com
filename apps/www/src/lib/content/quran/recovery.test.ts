// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option, Result } from "effect";
import { ACTIVE_POINTER_TAG } from "@/lib/content/published/active";
import {
  QuranSnapshotRecoveryError,
  recoverStalePublishedQuranSnapshot,
} from "@/lib/content/quran/recovery";
import { resetTestRuntimeCache, testRuntimeCache } from "@/test/store";

const activeSnapshotId = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const staleSnapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
const readIdentityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/quran/publication", () => ({
  readPublishedQuranIdentity: readIdentityMock,
}));

vi.mock("@/lib/content/store/memory", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { makeMemoryStore: () => cache };
});

beforeEach(() => {
  readIdentityMock.mockReset().mockReturnValue(
    Effect.succeed({
      snapshotId: activeSnapshotId,
    })
  );
  resetTestRuntimeCache();
});

describe("stale published Quran snapshot recovery", () => {
  it.effect("rejects invalid input before reading active state", () =>
    Effect.gen(function* () {
      const result = yield* recoverStalePublishedQuranSnapshot(
        "not-a-snapshot"
      ).pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toMatchObject({
          _tag: "QuranSnapshotRecoveryError",
          reason: "invalid-input",
        });
      }
      expect(readIdentityMock).not.toHaveBeenCalled();
      expect(testRuntimeCache.expireTag).not.toHaveBeenCalled();
    })
  );

  it.effect("keeps the active snapshot without expiring any entry", () =>
    Effect.gen(function* () {
      const recovered =
        yield* recoverStalePublishedQuranSnapshot(activeSnapshotId);

      expect(recovered).toBe(false);
      expect(testRuntimeCache.expireTag).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "drops the stored release pointer and keeps every other entry",
    () =>
      Effect.gen(function* () {
        testRuntimeCache.set("pointer", "stored", {
          expiresAt: 1000,
          now: 0,
          tags: [ACTIVE_POINTER_TAG],
        });
        testRuntimeCache.set("release", "kept", {
          expiresAt: 1000,
          now: 0,
          tags: ["content-release:release-a"],
        });

        const recovered =
          yield* recoverStalePublishedQuranSnapshot(staleSnapshotId);

        expect(recovered).toBe(true);
        expect(testRuntimeCache.get("pointer")).toStrictEqual(Option.none());
        expect(testRuntimeCache.get("release")).toStrictEqual(
          Option.some("kept")
        );
      })
  );

  it.effect(
    "maps active identity failures into the recovery error channel",
    () =>
      Effect.gen(function* () {
        const sourceFailure = new Error("identity unavailable");
        readIdentityMock.mockReturnValueOnce(Effect.fail(sourceFailure));

        const result = yield* recoverStalePublishedQuranSnapshot(
          staleSnapshotId
        ).pipe(Effect.result);

        expect(result).toEqual(
          Result.fail(
            new QuranSnapshotRecoveryError({
              cause: sourceFailure,
              reason: "active-identity",
            })
          )
        );
      })
  );
});
