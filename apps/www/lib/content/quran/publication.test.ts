// @vitest-environment node
import { beforeEach, describe, expect, it, layer } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import {
  encodeTestQuranRow,
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { makeQuranRuntimeSource } from "@repo/backend/test/quran/runtime";
import { Context, Effect, Layer } from "effect";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
  readPublishedQuranCatalog,
  readPublishedQuranIdentity,
  readPublishedQuranMarkdown,
} from "@/lib/content/quran/publication";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const readRuntimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/cache", () => ({
  applyPublishedSnapshotCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readRuntimeQueryMock,
}));
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
  readRuntimeQueryMock.mockReset();
  readRuntimeQueryMock.mockImplementation(
    createTestRuntimeQuery(runtimeQueryMock)
  );
});
describe("published Quran content", () => {
  it.effect("reads the active identity through the attribution query", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValue({
        ...source,
        rowJson: "attribution-row",
      });

      const identity = yield* readPublishedQuranIdentity();

      expect(identity).toMatchObject({ snapshotId: source.snapshotId });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {});
    })
  );

  it.effect("reads and caches the signed catalog", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValue(catalogResult());

      const catalog = yield* readPublishedQuranCatalog();
      const cachedCatalog = yield* Effect.tryPromise(() =>
        getPublishedQuranCatalog()
      );

      expect(catalog).toMatchObject({ surahs: expect.any(Array) });
      expect(cachedCatalog).toMatchObject({ surahs: expect.any(Array) });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {});
      expect(cacheMock).toHaveBeenCalledWith(source.snapshotId);
    })
  );

  it.effect("reads the locale-specific signed markdown", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValue(markdownResult());

      const markdown = yield* readPublishedQuranMarkdown("id", 1, 80);

      expect(markdown).toMatchObject({
        surah: {
          name: {
            meaning: makeQuranMeaning(1),
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
      expect(runtimeQueryMock).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("reads complete signed markdown without a verse limit", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValue(markdownResult());

      const markdown = yield* readPublishedQuranMarkdown("id", 1);

      expect(markdown).toMatchObject({
        surah: { number: 1 },
        verses: [{ number: {} }],
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
        appLocale: "id",
        surahNumber: 1,
      });
    })
  );

  it.effect("keeps a failed Quran query in the Effect error channel", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockRejectedValueOnce(new Error("Quran unavailable"));

      const result = yield* readPublishedQuranCatalog().pipe(Effect.result);

      expect(result).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "TestRuntimeQueryError",
          message: "Error: Quran unavailable",
        },
      });
    })
  );

  it.effect("caches the locale-specific Quran web projection", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValue(viewResult());

      const view = yield* Effect.tryPromise(() =>
        getPublishedQuranView("id", 1)
      );

      expect(view).toMatchObject({
        appLocale: "id",
        nextSurah: {
          name: {
            meaning: makeQuranMeaning(2),
          },
          number: 2,
        },
        surah: {
          name: {
            meaning: makeQuranMeaning(1),
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
      expect(runtimeQueryMock).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("preserves the final surah and its previous neighbor", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValue(finalViewResult());

      const view = yield* Effect.tryPromise(() =>
        getPublishedQuranView("id", 114)
      );

      expect(view).toMatchObject({
        nextSurah: null,
        previousSurah: {
          name: {
            meaning: makeQuranMeaning(113),
          },
          number: 113,
        },
        surah: {
          name: {
            meaning: makeQuranMeaning(114),
          },
          number: 114,
        },
      });
    })
  );
});

describe("immutable Quran application reads", () => {
  const prepareQuran = Effect.gen(function* () {
    const fixture = yield* makeQuranRuntimeSource();
    const context = yield* createTestSnapshotContext(fixture.source);
    return { context, manifest: fixture.manifest, state: fixture.state };
  });
  class QuranFixture extends Context.Service<
    QuranFixture,
    Effect.Success<typeof prepareQuran>
  >()("TestContent.QuranFixture") {}

  layer(Layer.effect(QuranFixture, prepareQuran))((test) => {
    test.effect(
      "returns the authenticated identity and complete cached metadata catalog",
      () =>
        Effect.gen(function* () {
          const quran = yield* QuranFixture;
          readRuntimeQueryMock.mockImplementation(
            createTestSnapshotQuery(quran.context)
          );
          const identity = yield* readPublishedQuranIdentity();
          const catalog = yield* readPublishedQuranCatalog();
          const cached = yield* Effect.promise(getPublishedQuranCatalog);
          expect(identity).toMatchObject({
            activeReleaseId: quran.state.activeReleaseId,
            activeManifestHash: quran.state.activeManifestHash,
            snapshotId: quran.manifest.snapshotId,
          });
          expect(catalog.surahs.map((surah) => surah.number)).toEqual(
            Array.from({ length: QURAN_SURAH_COUNT }, (_, index) => index + 1)
          );
          expect(cached).toEqual(catalog);
          expect(cacheMock).toHaveBeenCalledWith(quran.manifest.snapshotId);
        })
    );

    test.effect.each(APP_LOCALE_CODES)(
      "preserves %s source attribution, verses, and web navigation",
      (appLocale) =>
        Effect.gen(function* () {
          const quran = yield* QuranFixture;
          readRuntimeQueryMock.mockImplementation(
            createTestSnapshotQuery(quran.context)
          );
          const prefix = yield* readPublishedQuranMarkdown(appLocale, 1, 3);
          const complete = yield* readPublishedQuranMarkdown(appLocale, 1);
          const view = yield* Effect.promise(() =>
            getPublishedQuranView(appLocale, 1)
          );
          expect(prefix.toVerse).toBe(3);
          expect(prefix.verses).toHaveLength(3);
          expect(complete.verses).toHaveLength(complete.surah.numberOfVerses);
          expect(prefix.verses).toEqual(complete.verses.slice(0, 3));
          expect(prefix.sources).toEqual(makeQuranLocaleSources(appLocale));
          expect(view.sources).toEqual(prefix.sources);
          expect(view.tafsirAccess).toEqual(
            makeQuranTafsirProjection(appLocale)
          );
          expect(view.surah.name.meaning).toEqual(makeQuranMeaning(1));
          expect(view.previousSurah).toBeNull();
          expect(view.nextSurah?.number).toBe(2);
          expect(view.verses[0]).toMatchObject({
            arabic: "آية 1",
            number: { inQuran: 1, inSurah: 1 },
            translation: prefix.verses[0]?.translation,
          });
          expect(view.verses).toHaveLength(complete.verses.length);
        })
    );
  });

  it.effect(
    "keeps an inactive Quran publication in the domain error channel",
    () =>
      Effect.gen(function* () {
        const inactive = yield* createTestSnapshotContext(
          makeRuntimeSource().source
        );
        readRuntimeQueryMock.mockImplementation(
          createTestSnapshotQuery(inactive)
        );
        expect(
          yield* readPublishedQuranIdentity().pipe(Effect.flip)
        ).toMatchObject({
          _tag: "QuranPublicationError",
          operation: "attribution",
          reason: "Signed Quran publication is not active.",
        });
      })
  );
});
/** Builds the complete signed metadata catalog response. */
function catalogResult(snapshotId = source.snapshotId) {
  return {
    ...source,
    snapshotId,
    rowJson: Array.from({ length: 114 }, (_, index) =>
      encodeTestQuranRow(snapshotId, makeQuranSurah(index + 1))
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
        sourceMeaning: makeQuranMeaning(2),
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    },
    previousSurah: null,
    surah: {
      name: {
        sourceMeaning: makeQuranMeaning(1),
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

/** Builds the final Quran web response with no next neighbor. */
function finalViewResult() {
  const result = viewResult();
  const previousSurah = makeQuranSurah(113);
  const surah = makeQuranSurah(114);
  return {
    ...result,
    nextSurah: null,
    previousSurah: {
      ...previousSurah,
      name: {
        sourceMeaning: previousSurah.name.meaning,
        transliteration: previousSurah.name.transliteration,
      },
      numberOfVerses: 1,
    },
    surah: {
      ...surah,
      name: {
        sourceMeaning: surah.name.meaning,
        transliteration: surah.name.transliteration,
      },
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
        sourceMeaning: makeQuranMeaning(1),
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
