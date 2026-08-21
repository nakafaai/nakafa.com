// @vitest-environment node
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  QuranSnapshotRecoveryError,
  recoverStalePublishedQuranSnapshot,
} from "@/lib/content/quran/recovery";

const activeSnapshotId = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const staleSnapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
const readIdentityMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const updateTagMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/quran/publication", () => ({
  readPublishedQuranIdentity: readIdentityMock,
}));
vi.mock("next/cache", () => ({
  refresh: refreshMock,
  updateTag: updateTagMock,
}));
beforeEach(() => {
  readIdentityMock.mockReset().mockReturnValue(
    Effect.succeed({
      snapshotId: activeSnapshotId,
    })
  );
  refreshMock.mockReset();
  updateTagMock.mockReset();
});
describe("stale published Quran snapshot recovery", () => {
  it("rejects an invalid captured snapshot before reading active state", async () => {
    const result = await Effect.runPromise(
      recoverStalePublishedQuranSnapshot("not-a-snapshot").pipe(Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toMatchObject({
        _tag: "QuranSnapshotRecoveryError",
        reason: "invalid-input",
      });
    }
    expect(readIdentityMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(updateTagMock).not.toHaveBeenCalled();
  });
  it("refreshes without expiring the currently active snapshot", async () => {
    await expect(
      Effect.runPromise(recoverStalePublishedQuranSnapshot(activeSnapshotId))
    ).resolves.toBe(false);
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(updateTagMock).not.toHaveBeenCalled();
  });
  it("immediately expires only the captured stale snapshot tag", async () => {
    await expect(
      Effect.runPromise(recoverStalePublishedQuranSnapshot(staleSnapshotId))
    ).resolves.toBe(true);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(updateTagMock).toHaveBeenCalledWith(
      `content-artifact:${staleSnapshotId}`
    );
  });
  it("maps active identity failures into the recovery error channel", async () => {
    const sourceFailure = new Error("identity unavailable");
    readIdentityMock.mockReturnValueOnce(Effect.fail(sourceFailure));
    const result = await Effect.runPromise(
      recoverStalePublishedQuranSnapshot(staleSnapshotId).pipe(Effect.result)
    );
    expect(result).toEqual(
      Result.fail(
        new QuranSnapshotRecoveryError({
          cause: sourceFailure,
          reason: "active-identity",
        })
      )
    );
  });
  it("keeps route refresh failures in the typed error channel", async () => {
    refreshMock.mockImplementationOnce(() => {
      throw new Error("refresh unavailable");
    });
    const result = await Effect.runPromise(
      recoverStalePublishedQuranSnapshot(activeSnapshotId).pipe(Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toMatchObject({
        _tag: "QuranSnapshotRecoveryError",
        reason: "route-refresh",
      });
    }
  });
  it("keeps cache invalidation failures in the typed error channel", async () => {
    updateTagMock.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });
    const result = await Effect.runPromise(
      recoverStalePublishedQuranSnapshot(staleSnapshotId).pipe(Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toMatchObject({
        _tag: "QuranSnapshotRecoveryError",
        reason: "cache-invalidation",
      });
    }
  });
});
