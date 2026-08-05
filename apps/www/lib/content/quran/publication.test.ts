// @vitest-environment node

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  encodeTestQuranRow,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedQuranCatalog,
  getPublishedQuranPage,
  readPublishedQuranCatalog,
  readPublishedQuranPage,
} from "@/lib/content/quran/publication";

const fetchMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: "c".repeat(40),
};

beforeEach(() => {
  cacheMock.mockReset();
  fetchMock.mockReset();
});

describe("published Quran content", () => {
  it("reads the signed catalog through Effect and cached Promise boundaries", async () => {
    fetchMock.mockResolvedValue(catalogResult());

    await expect(
      Effect.runPromise(readPublishedQuranCatalog())
    ).resolves.toMatchObject({ surahs: expect.any(Array) });
    await expect(getPublishedQuranCatalog()).resolves.toMatchObject({
      surahs: expect.any(Array),
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), {});
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("reads one signed page through Effect and cached Promise boundaries", async () => {
    const result = pageResult();
    fetchMock.mockResolvedValue(result);

    await expect(
      Effect.runPromise(readPublishedQuranPage("id", 1))
    ).resolves.toMatchObject({
      surah: { number: 1 },
      verses: [{ number: {} }],
    });
    await expect(getPublishedQuranPage("id", 1)).resolves.toMatchObject({
      surah: { number: 1 },
      verses: [{ number: {} }],
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), {
      locale: "id",
      surahNumber: 1,
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });
});

/** Builds the complete signed metadata catalog response. */
function catalogResult() {
  return {
    ...source,
    rowJson: Array.from({ length: 114 }, (_, index) =>
      encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
    ),
  };
}

/** Builds one complete signed Quran page response. */
function pageResult() {
  const chunk = makeQuranChunk({
    firstQuranNumber: 1,
    firstVerse: 1,
    surahNumber: 1,
    verseCount: 1,
  });
  return {
    ...source,
    chunkJson: [encodeTestQuranRow(source.snapshotId, chunk)],
    nextSurahJson: encodeTestQuranRow(source.snapshotId, makeQuranSurah(2)),
    prevSurahJson: null,
    searchJson: encodeTestQuranRow(source.snapshotId, makeQuranSearch("id", 1)),
    surahJson: encodeTestQuranRow(source.snapshotId, makeQuranSurah(1)),
  };
}
