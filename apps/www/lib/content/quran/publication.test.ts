// @vitest-environment node

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
  readPublishedQuranCatalog,
  readPublishedQuranIdentity,
  readPublishedQuranMarkdown,
} from "@/lib/content/quran/publication";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/cache", () => ({
  applyPublishedSnapshotCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
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
  runtimeQueryMock.mockReset();
});

describe("published Quran content", () => {
  it("reads the active identity through the one-row attribution query", async () => {
    runtimeQueryMock.mockResolvedValue({
      ...source,
      rowJson: "attribution-row",
    });

    await expect(
      Effect.runPromise(readPublishedQuranIdentity())
    ).resolves.toMatchObject({ snapshotId: source.snapshotId });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("reads and caches the signed catalog through the Effect boundary", async () => {
    runtimeQueryMock.mockResolvedValue(catalogResult());

    await expect(
      Effect.runPromise(readPublishedQuranCatalog())
    ).resolves.toMatchObject({ surahs: expect.any(Array) });
    await expect(getPublishedQuranCatalog()).resolves.toMatchObject({
      surahs: expect.any(Array),
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {});
    expect(cacheMock).toHaveBeenCalledWith(source.snapshotId);
  });

  it("reads the locale-specific signed markdown through the Effect boundary", async () => {
    const result = markdownResult();
    runtimeQueryMock.mockResolvedValue(result);

    await expect(
      Effect.runPromise(readPublishedQuranMarkdown("id", 1, 80))
    ).resolves.toMatchObject({
      surah: { number: 1 },
      verses: [{ number: {} }],
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "id",
      surahNumber: 1,
      verseLimit: 80,
    });
  });

  it("reads the complete signed markdown when no verse limit is requested", async () => {
    runtimeQueryMock.mockResolvedValue(markdownResult());

    await expect(
      Effect.runPromise(readPublishedQuranMarkdown("id", 1))
    ).resolves.toMatchObject({
      surah: { number: 1 },
      verses: [{ number: {} }],
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "id",
      surahNumber: 1,
    });
  });

  it("keeps a failed Quran query in the Effect error channel", async () => {
    runtimeQueryMock.mockRejectedValueOnce(new Error("Quran unavailable"));

    await expect(
      Effect.runPromise(Effect.either(readPublishedQuranCatalog()))
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "TestRuntimeQueryError",
        message: "Error: Quran unavailable",
      },
    });
  });

  it("caches the locale-specific Quran web projection", async () => {
    runtimeQueryMock.mockResolvedValue(viewResult());

    await expect(getPublishedQuranView("id", 1)).resolves.toMatchObject({
      appLocale: "id",
      surah: { number: 1 },
      verses: [
        {
          translation: "Terjemahan teknis 1",
        },
      ],
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "id",
      surahNumber: 1,
    });
    expect(cacheMock).toHaveBeenCalledWith(source.snapshotId);
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

/** Builds one narrow locale-specific Quran web response. */
function viewResult() {
  return {
    ...source,
    appLocale: "id",
    nextSurah: {
      name: {
        translation: "Technical meaning 2",
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    },
    previousSurah: null,
    surah: {
      name: {
        translation: "Technical meaning 1",
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
    },
    verses: [
      {
        arabic: "آية 1",
        number: { inQuran: 1, inSurah: 1 },
        translation: "Terjemahan teknis 1",
      },
    ],
  };
}

/** Builds one locale-specific signed Quran markdown response. */
function markdownResult() {
  return {
    ...source,
    appLocale: "id",
    surah: {
      name: {
        translation: "Technical meaning 1",
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { place: "Meccan" },
    },
    toVerse: 1,
    verses: [
      {
        arabic: "آية 1",
        number: { inSurah: 1 },
        translation: { footnotes: "", text: "Terjemahan teknis 1" },
      },
    ],
  };
}
