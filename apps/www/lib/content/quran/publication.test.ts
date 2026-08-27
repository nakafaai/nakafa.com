// @vitest-environment node
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import {
  encodeTestQuranRow,
  makeQuranLocaleSources,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { type FunctionReference, getFunctionName } from "convex/server";
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
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
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
    useProjectionFixture(
      api.contentRelease.quran.prose,
      legacyMarkdownResult()
    );
    await expect(
      Effect.runPromise(readPublishedQuranMarkdown("id", 1, 80))
    ).resolves.toMatchObject({
      surah: {
        name: {
          meaning: { appLocale: "en", text: "Technical meaning 1" },
        },
        number: 1,
      },
      verses: [{ number: {} }],
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "id",
      surahNumber: 1,
      verseLimit: 80,
    });
  });
  it("reads the complete signed markdown when no verse limit is requested", async () => {
    useProjectionFixture(
      api.contentRelease.quran.prose,
      legacyMarkdownResult()
    );
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
      Effect.runPromise(Effect.result(readPublishedQuranCatalog()))
    ).resolves.toMatchObject({
      _tag: "Failure",
      failure: {
        _tag: "TestRuntimeQueryError",
        message: "Error: Quran unavailable",
      },
    });
  });
  it("caches the locale-specific Quran web projection", async () => {
    useProjectionFixture(api.contentRelease.quran.page, legacyViewResult());
    await expect(getPublishedQuranView("id", 1)).resolves.toMatchObject({
      appLocale: "id",
      nextSurah: {
        name: {
          meaning: { appLocale: "en", text: "Technical meaning 2" },
        },
        number: 2,
      },
      surah: {
        name: {
          meaning: { appLocale: "en", text: "Technical meaning 1" },
        },
        number: 1,
      },
      verses: [
        {
          translation: {
            notes: [
              {
                number: 4,
                referenceOffset: 20,
                text: "Catatan terjemahan Indonesia.",
              },
            ],
            segments: [
              { kind: "text", offset: 0, value: "Terjemahan teknis 1." },
              { kind: "note", number: 4, offset: 20 },
            ],
          },
        },
      ],
    });
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      appLocale: "id",
      surahNumber: 1,
    });
    expect(cacheMock).toHaveBeenCalledWith(source.snapshotId);
  });
  it("aligns the final surah and its previous neighbor", async () => {
    useProjectionFixture(
      api.contentRelease.quran.page,
      legacyFinalViewResult()
    );
    await expect(getPublishedQuranView("id", 114)).resolves.toMatchObject({
      nextSurah: null,
      previousSurah: {
        name: {
          meaning: { appLocale: "en", text: "Technical meaning 113" },
        },
        number: 113,
      },
      surah: {
        name: {
          meaning: { appLocale: "en", text: "Technical meaning 114" },
        },
        number: 114,
      },
    });
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

/** Routes one projection and its canonical catalog through the runtime mock. */
function useProjectionFixture(
  projection: FunctionReference<"query">,
  result: unknown
) {
  runtimeQueryMock.mockImplementation((query: FunctionReference<"query">) => {
    if (
      getFunctionName(query) ===
      getFunctionName(api.contentRelease.quran.surahs)
    ) {
      return Promise.resolve(catalogResult());
    }
    if (getFunctionName(query) === getFunctionName(projection)) {
      return Promise.resolve(result);
    }
    return Promise.reject(new Error("Unhandled Quran publication query."));
  });
}
/** Builds one narrow locale-specific Quran web response. */
function viewResult() {
  return {
    ...source,
    appLocale: "id",
    nextSurah: {
      name: {
        meaning: { appLocale: "en", text: "Technical meaning 2" },
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    },
    previousSurah: null,
    surah: {
      name: {
        meaning: { appLocale: "en", text: "Technical meaning 1" },
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
    },
    sources: makeQuranLocaleSources("id"),
    tafsirAccess: makeQuranTafsirProjection("id"),
    verses: [
      {
        arabic: "آية 1",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 4,
              referenceOffset: 20,
              text: "Catatan terjemahan Indonesia.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "Terjemahan teknis 1." },
            { kind: "note", number: 4, offset: 20 },
          ],
        },
      },
    ],
  };
}

/** Simulates the deployed predecessor view during the rollout switch. */
function legacyViewResult() {
  const result = viewResult();
  return {
    ...result,
    nextSurah: {
      ...result.nextSurah,
      name: { ...result.nextSurah.name, meaning: null },
    },
    surah: {
      ...result.surah,
      name: { ...result.surah.name, meaning: null },
    },
  };
}

/** Simulates the final deployed predecessor view with no next neighbor. */
function legacyFinalViewResult() {
  const result = viewResult();
  const previousSurah = makeQuranSurah(113);
  const surah = makeQuranSurah(114);
  return {
    ...result,
    nextSurah: null,
    previousSurah: {
      ...previousSurah,
      name: { ...previousSurah.name, meaning: null },
      numberOfVerses: 1,
    },
    surah: {
      ...surah,
      name: { ...surah.name, meaning: null },
      numberOfVerses: 1,
    },
  };
}
/** Builds one locale-specific signed Quran markdown response. */
function markdownResult() {
  return {
    ...source,
    appLocale: "id",
    sources: makeQuranLocaleSources("id"),
    surah: {
      name: {
        meaning: { appLocale: "en", text: "Technical meaning 1" },
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { place: "Meccan" },
    },
    tafsirAccess: makeQuranTafsirProjection("id"),
    toVerse: 1,
    verses: [
      {
        arabic: "آية 1",
        number: { inSurah: 1 },
        translation: {
          notes: [],
          segments: [{ kind: "text", offset: 0, value: "Terjemahan teknis 1" }],
        },
      },
    ],
  };
}

/** Simulates the deployed predecessor Markdown during the rollout switch. */
function legacyMarkdownResult() {
  const result = markdownResult();
  return {
    ...result,
    surah: {
      ...result.surah,
      name: { ...result.surah.name, meaning: null },
    },
  };
}
