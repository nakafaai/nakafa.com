import { HttpClient } from "@confect/js";
// @vitest-environment node
import { beforeEach, describe, expect, it, layer } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import {
  createTestPublication,
  makeRuntimeSource,
} from "@repo/backend/test/content/publication";
import {
  encodeTestQuranRow,
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { makeQuranRuntimeSource } from "@repo/backend/test/quran/runtime";
import { Array as Arr, Context, Effect, Layer, Result } from "effect";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
  readPublishedQuranCatalog,
  readPublishedQuranIdentity,
  readPublishedQuranMarkdown,
} from "@/lib/content/quran/publication";
import { activateTestRelease } from "@/test/active";
import {
  finalViewResult,
  quranSource as source,
  viewResult,
} from "@/test/quran";
import { resetTestRuntimeCache } from "@/test/store";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/cache", () => ({}));
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
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
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
beforeEach(() => {
  resetTestRuntimeCache();
  activateTestRelease("quran-release");
  runtimeQueryMock.mockReset();
});
/** Each malformed signed catalog, derived from the complete 114-surah catalog rows. */
const MALFORMED_CATALOGS: readonly (readonly [
  string,
  (rows: readonly string[]) => readonly string[],
])[] = [
  ["empty", () => []],
  ["incomplete", (rows) => Arr.take(rows, 1)],
  ["out of order", (rows) => Arr.reverse(rows)],
];

describe("published Quran content", () => {
  it.effect("reads the active identity through the attribution query", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValue(
        Effect.succeed({
          ...source,
          rowJson: "attribution-row",
        })
      );
      const identity = yield* readPublishedQuranIdentity();
      expect(identity).toMatchObject({
        snapshotId: source.snapshotId,
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {});
    })
  );
  it.effect("reads and caches the signed catalog", () =>
    Effect.gen(function* () {
      const signedCatalog = yield* catalogResult();
      runtimeQueryMock.mockReturnValue(Effect.succeed(signedCatalog));
      const catalog = yield* readPublishedQuranCatalog();
      const cachedCatalog = yield* Effect.tryPromise(() =>
        getPublishedQuranCatalog()
      );
      expect(catalog).toMatchObject({
        surahs: expect.any(Array),
      });
      expect(cachedCatalog).toMatchObject({
        surahs: expect.any(Array),
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {});
    })
  );
  it.effect.each(MALFORMED_CATALOGS)(
    "rejects an %s signed catalog",
    ([_label, select]) =>
      Effect.gen(function* () {
        const signedCatalog = yield* catalogResult();
        runtimeQueryMock.mockReturnValueOnce(
          Effect.succeed({
            ...signedCatalog,
            rowJson: select(signedCatalog.rowJson),
          })
        );
        expect(
          yield* readPublishedQuranCatalog().pipe(Effect.flip)
        ).toMatchObject({
          _tag: "QuranPublicationError",
          operation: "catalog",
        });
      })
  );
  it.effect("reads the locale-specific signed markdown", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValue(Effect.succeed(markdownResult()));
      const markdown = yield* readPublishedQuranMarkdown("id", 1, 80);
      expect(markdown).toMatchObject({
        surah: {
          name: {
            meaning: makeQuranMeaning(1),
          },
          number: 1,
        },
        verses: [
          {
            number: {},
          },
        ],
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
      runtimeQueryMock.mockReturnValue(Effect.succeed(markdownResult()));
      const markdown = yield* readPublishedQuranMarkdown("id", 1);
      expect(markdown).toMatchObject({
        surah: {
          number: 1,
        },
        verses: [
          {
            number: {},
          },
        ],
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
        appLocale: "id",
        surahNumber: 1,
      });
    })
  );
  it.effect("keeps a failed Quran query in the Effect error channel", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.fail(
          new HttpClient.HttpClientError({
            cause: new Error("Quran unavailable"),
          })
        )
      );
      const result = yield* readPublishedQuranCatalog().pipe(Effect.result);
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toMatchObject({
          _tag: "HttpClientError",
          cause: expect.objectContaining({ message: "Quran unavailable" }),
        });
      }
    })
  );
  it.effect("caches the locale-specific Quran web projection", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValue(Effect.succeed(viewResult()));
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
                {
                  kind: "text",
                  offset: 0,
                  value: "Terjemahan teknis 1.",
                },
                {
                  kind: "note",
                  number: 4,
                  offset: 20,
                },
              ],
            },
          },
        ],
      });
      expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
        appLocale: "id",
        surahNumber: 1,
      });
      expect(runtimeQueryMock).toHaveBeenCalledTimes(1);
    })
  );
  it.effect("preserves the final surah and its previous neighbor", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValue(Effect.succeed(finalViewResult()));
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
    const context = yield* createTestPublication(fixture.source);
    return {
      context,
      manifest: fixture.manifest,
      state: fixture.state,
    };
  });
  class QuranFixture extends Context.Service<
    QuranFixture,
    Effect.Success<typeof prepareQuran>
  >()("www/lib/content/quran/publication.test/QuranFixture") {}
  layer(Layer.effect(QuranFixture, prepareQuran))((test) => {
    test.effect(
      "reaches Convex once for the catalog and for each view of a release",
      () =>
        Effect.gen(function* () {
          const quran = yield* QuranFixture;
          runtimeQueryMock.mockImplementation(quran.context.query);

          yield* readPublishedQuranCatalog();
          yield* Effect.promise(getPublishedQuranCatalog);
          expect(runtimeQueryMock).toHaveBeenCalledTimes(1);

          yield* Effect.promise(() => getPublishedQuranView("id", 1));
          yield* Effect.promise(() => getPublishedQuranView("id", 1));
          expect(runtimeQueryMock).toHaveBeenCalledTimes(2);

          yield* Effect.promise(() => getPublishedQuranView("en", 1));
          expect(runtimeQueryMock).toHaveBeenCalledTimes(3);

          activateTestRelease("quran-release-next");
          yield* Effect.promise(() => getPublishedQuranView("id", 1));
          expect(runtimeQueryMock).toHaveBeenCalledTimes(4);
        })
    );
    test.effect(
      "returns the authenticated identity and complete cached metadata catalog",
      () =>
        Effect.gen(function* () {
          const quran = yield* QuranFixture;
          runtimeQueryMock.mockImplementation(quran.context.query);
          const identity = yield* readPublishedQuranIdentity();
          const catalog = yield* readPublishedQuranCatalog();
          const cached = yield* Effect.promise(getPublishedQuranCatalog);
          expect(identity).toMatchObject({
            activeReleaseId: quran.state.activeReleaseId,
            activeManifestHash: quran.state.activeManifestHash,
            snapshotId: quran.manifest.snapshotId,
          });
          expect(Arr.map(catalog.surahs, (surah) => surah.number)).toEqual(
            Array.from(
              {
                length: QURAN_SURAH_COUNT,
              },
              (_, index) => index + 1
            )
          );
          expect(cached).toEqual(catalog);
        })
    );
    test.effect.each(APP_LOCALE_CODES)(
      "preserves %s source attribution, verses, and web navigation",
      (appLocale) =>
        Effect.gen(function* () {
          const quran = yield* QuranFixture;
          runtimeQueryMock.mockImplementation(quran.context.query);
          const prefix = yield* readPublishedQuranMarkdown(appLocale, 1, 3);
          const complete = yield* readPublishedQuranMarkdown(appLocale, 1);
          const view = yield* Effect.promise(() =>
            getPublishedQuranView(appLocale, 1)
          );
          expect(prefix.toVerse).toBe(3);
          expect(prefix.verses).toHaveLength(3);
          expect(complete.verses).toHaveLength(complete.surah.numberOfVerses);
          expect(prefix.verses).toEqual(Arr.take(complete.verses, 3));
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
            number: {
              inQuran: 1,
              inSurah: 1,
            },
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
        const inactive = yield* createTestPublication(
          (yield* makeRuntimeSource()).source
        );
        runtimeQueryMock.mockImplementation(inactive.query);
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
const catalogResult = Effect.fn("test.www.quranCatalogResult")(function* (
  snapshotId = source.snapshotId
) {
  const rowJson = yield* Effect.forEach(
    Arr.makeBy(114, (index) => index),
    (index) => encodeTestQuranRow(snapshotId, makeQuranSurah(index + 1))
  );
  return { ...source, rowJson, snapshotId };
});

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
      revelation: {
        place: "Meccan",
      },
    },
    tafsirAccess: makeQuranTafsirProjection("id"),
    toVerse: 1,
    verses: [
      {
        arabic: "آية 1",
        number: {
          inSurah: 1,
        },
        translation: {
          notes: [],
          segments: [
            {
              kind: "text",
              offset: 0,
              value: "Terjemahan teknis 1",
            },
          ],
        },
      },
    ],
  };
}
