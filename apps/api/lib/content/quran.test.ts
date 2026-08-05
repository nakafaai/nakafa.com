import {
  encodeTestQuranRow,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readQuranApiPage } from "@/lib/content/quran";

const runtimeClientMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeClientMocks.fetchConvexRuntimeQuery,
}));

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: `sha256:${"b".repeat(64)}`,
  sourceRevision: "c".repeat(40),
};

afterEach(() => {
  runtimeClientMocks.fetchConvexRuntimeQuery.mockReset();
});

describe("Quran API content", () => {
  it("reads and validates one signed Quran page", async () => {
    const surah = makeQuranSurah(1);
    const chunk = makeQuranChunk({
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
      verseCount: 1,
    });
    const search = makeQuranSearch("en", 1);
    const nextSurah = makeQuranSurah(2);
    runtimeClientMocks.fetchConvexRuntimeQuery.mockResolvedValueOnce({
      ...source,
      chunkJson: [encodeTestQuranRow(source.snapshotId, chunk)],
      nextSurahJson: encodeTestQuranRow(source.snapshotId, nextSurah),
      prevSurahJson: null,
      searchJson: encodeTestQuranRow(source.snapshotId, search),
      surahJson: encodeTestQuranRow(source.snapshotId, surah),
    });

    await expect(
      Effect.runPromise(readQuranApiPage({ locale: "en", surahNumber: 1 }))
    ).resolves.toEqual({
      activeManifestHash: source.activeManifestHash,
      activeReleaseId: source.activeReleaseId,
      nextSurah,
      previousSurah: null,
      search,
      snapshotId: source.snapshotId,
      sourceRevision: source.sourceRevision,
      surah,
      verses: chunk.verses,
    });
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      { locale: "en", surahNumber: 1 }
    );
  });

  it("maps transport and publication failures into its domain error", async () => {
    runtimeClientMocks.fetchConvexRuntimeQuery.mockRejectedValueOnce(
      new Error("offline")
    );
    await expect(
      Effect.runPromise(
        Effect.either(readQuranApiPage({ locale: "en", surahNumber: 1 }))
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "QuranApiReadError" },
    });

    runtimeClientMocks.fetchConvexRuntimeQuery.mockResolvedValueOnce({
      ...source,
      chunkJson: [],
      nextSurahJson: null,
      prevSurahJson: null,
      searchJson: null,
      surahJson: null,
    });
    await expect(
      Effect.runPromise(
        Effect.either(readQuranApiPage({ locale: "en", surahNumber: 1 }))
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "QuranApiReadError" },
    });
  });
});
