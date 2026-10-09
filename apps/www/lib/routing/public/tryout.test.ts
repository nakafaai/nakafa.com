// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";

const TrackFixtureSchema = Schema.Struct({
  publicPath: Schema.String,
  trackKey: Schema.String,
  trackKind: Schema.String,
});
const ExamFixtureSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  publicPath: Schema.String,
  tracks: Schema.Array(TrackFixtureSchema),
});
const SectionFixtureSchema = Schema.Struct({
  appLocale: AppLocaleCodeSchema,
  publicPath: Schema.String,
});
type ExamFixture = typeof ExamFixtureSchema.Type;
type SectionFixture = typeof SectionFixtureSchema.Type;
/** One signed route identity, with the public path that each locale serves for it. */
type RouteIdentity = Partial<Record<AppLocaleCode, string>>;

const readLocalizedPathMock = vi.hoisted(() => vi.fn());
const readExamPageMock = vi.hoisted(() => vi.fn());
const readSectionPageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: readLocalizedPathMock,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: readExamPageMock,
  readPublishedTryoutSectionPage: readSectionPageMock,
}));

const SNBT_EXAM: RouteIdentity = {
  de: "try-out/indonesien/snbt",
  en: "try-out/indonesia/snbt",
  id: "try-out/indonesia/snbt",
};
const SNBT_2027_TRACK: RouteIdentity = {
  de: "try-out/indonesien/snbt/2027",
  en: "try-out/indonesia/snbt/2027",
  id: "try-out/indonesia/snbt/2027",
};
const SNBT_2027_SET_1: RouteIdentity = {
  de: "try-out/indonesien/snbt/2027/aufgabensatz-1",
  en: "try-out/indonesia/snbt/2027/set-1",
  id: "try-out/indonesia/snbt/2027/set-1",
};
const SNBT_2026_TRACK: RouteIdentity = {
  en: "try-out/indonesia/snbt/2026",
  id: "try-out/indonesia/snbt/2026",
};
const SNBT_2026_SET_1: RouteIdentity = {
  en: "try-out/indonesia/snbt/2026/set-1",
  id: "try-out/indonesia/snbt/2026/set-1",
};
const SNBT_EXAM_PAGES: readonly ExamFixture[] = [
  {
    appLocale: "en",
    publicPath: "try-out/indonesia/snbt",
    tracks: [
      {
        publicPath: "try-out/indonesia/snbt/2027",
        trackKey: "2027",
        trackKind: "year",
      },
    ],
  },
  {
    appLocale: "de",
    publicPath: "try-out/indonesien/snbt",
    tracks: [
      {
        publicPath: "try-out/indonesien/snbt/2027",
        trackKey: "2027",
        trackKind: "year",
      },
    ],
  },
];

/** Serves exactly the signed routes, exam pages, and visible sections of one catalog. */
function serveCatalog({
  exams = [],
  routes = [],
  sections = [],
}: {
  readonly exams?: readonly ExamFixture[];
  readonly routes?: readonly RouteIdentity[];
  readonly sections?: readonly SectionFixture[];
}) {
  readLocalizedPathMock.mockImplementation(
    ({
      currentAppLocale,
      publicPath,
      targetAppLocale,
    }: {
      readonly currentAppLocale: AppLocaleCode;
      readonly publicPath: string;
      readonly targetAppLocale: AppLocaleCode;
    }) =>
      Effect.succeed(
        Option.getOrNull(
          Option.flatMap(
            Arr.findFirst(
              routes,
              (route) => route[currentAppLocale] === publicPath
            ),
            (route) => Option.fromNullishOr(route[targetAppLocale])
          )
        )
      )
  );
  readExamPageMock.mockImplementation(
    ({
      appLocale,
      publicPath,
    }: {
      readonly appLocale: AppLocaleCode;
      readonly publicPath: string;
    }) =>
      Effect.succeed(
        Option.getOrNull(
          Arr.findFirst(
            exams,
            (exam) =>
              exam.appLocale === appLocale && exam.publicPath === publicPath
          )
        )
      )
  );
  readSectionPageMock.mockImplementation(
    ({
      appLocale,
      publicPath,
    }: {
      readonly appLocale: AppLocaleCode;
      readonly publicPath: string;
    }) =>
      Effect.succeed(
        Option.isSome(
          Arr.findFirst(
            sections,
            (section) =>
              section.appLocale === appLocale &&
              section.publicPath === publicPath
          )
        )
          ? { publicPath }
          : null
      )
  );
}

describe("retired try-out redirects", () => {
  beforeEach(() => {
    readLocalizedPathMock.mockReset();
    readExamPageMock.mockReset();
    readSectionPageMock.mockReset();
  });

  describe("retired SNBT section URLs", () => {
    it.effect.each([
      [
        "/id/try-out/indonesia/snbt/2027/set-3/bahasa-inggris",
        "id",
        "/id/try-out/indonesia/snbt/2027/set-3/literasi-dalam-bahasa-inggris",
      ],
      [
        "/en/try-out/indonesia/snbt/2027/set-1/reading-and-writing-skills",
        "en",
        "/en/try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing",
      ],
      [
        "/de/try-out/indonesien/snbt/2027/aufgabensatz-2/allgemeinwissen",
        "de",
        "/de/try-out/indonesien/snbt/2027/aufgabensatz-2/allgemeines-wissen-und-verstaendnis",
      ],
    ] as const)(
      "redirects %s once its successor is live",
      ([pathname, appLocale, successor]) =>
        Effect.gen(function* () {
          serveCatalog({
            routes: [{ [appLocale]: successor.slice(4) }],
          });

          expect(yield* readTryoutRedirect(pathname)).toBe(successor);
          expect(readLocalizedPathMock).toHaveBeenCalledWith({
            currentAppLocale: appLocale,
            publicPath: successor.slice(4),
            targetAppLocale: appLocale,
          });
        })
    );

    it.effect(
      "keeps a retired route that the active catalog still serves",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            routes: [
              {
                id: "try-out/indonesia/snbt/2027/set-1/pengetahuan-umum",
              },
              {
                id: "try-out/indonesia/snbt/2027/set-1/pengetahuan-dan-pemahaman-umum",
              },
            ],
          });

          expect(
            yield* readTryoutRedirect(
              "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-umum"
            )
          ).toBeNull();
        })
    );

    it.effect("waits until the active catalog serves the successor", () =>
      Effect.gen(function* () {
        serveCatalog({});

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/indonesia/snbt/2027/set-1/english-language"
          )
        ).toBeNull();
      })
    );
  });

  describe("retired SNBT exam URL", () => {
    it.effect.each([
      ["/en/try-out/snbt", "/en/try-out/indonesia/snbt"],
      ["/de/try-out/snbt", "/de/try-out/indonesien/snbt"],
    ])("redirects %s to its localized exam page", ([pathname, expected]) =>
      Effect.gen(function* () {
        serveCatalog({ routes: [SNBT_EXAM] });

        expect(yield* readTryoutRedirect(pathname)).toBe(expected);
      })
    );

    it.effect("waits until the localized exam page is live", () =>
      Effect.gen(function* () {
        serveCatalog({});

        expect(yield* readTryoutRedirect("/en/try-out/snbt")).toBeNull();
      })
    );

    it.effect(
      "keeps the retired exam path when the catalog still serves it",
      () =>
        Effect.gen(function* () {
          serveCatalog({ routes: [SNBT_EXAM, { en: "try-out/snbt" }] });

          expect(yield* readTryoutRedirect("/en/try-out/snbt")).toBeNull();
        })
    );
  });

  describe("retired SNBT product URLs", () => {
    it.effect(
      "leaves the 2026 set to the gone answer when no 2026 track is live",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/snbt/2026-set-1")
          ).toBeNull();
        })
    );

    it.effect.each([
      ["/en/try-out/snbt/2027-set-1", "/en/try-out/indonesia/snbt/2027/set-1"],
      [
        "/de/try-out/snbt/2027-set-1",
        "/de/try-out/indonesien/snbt/2027/aufgabensatz-1",
      ],
    ])("redirects %s to its localized set", ([pathname, expected]) =>
      Effect.gen(function* () {
        serveCatalog({
          exams: SNBT_EXAM_PAGES,
          routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
        });

        expect(yield* readTryoutRedirect(pathname)).toBe(expected);
      })
    );

    it.effect("waits until the localized set is live", () =>
      Effect.gen(function* () {
        serveCatalog({ exams: SNBT_EXAM_PAGES, routes: [SNBT_EXAM] });

        expect(
          yield* readTryoutRedirect("/en/try-out/snbt/2027-set-1")
        ).toBeNull();
      })
    );

    it.effect(
      "keeps the retired set path when the catalog still serves it",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [
              SNBT_EXAM,
              SNBT_2027_TRACK,
              SNBT_2027_SET_1,
              { en: "try-out/snbt/2027-set-1" },
            ],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/snbt/2027-set-1")
          ).toBeNull();
        })
    );

    it.effect(
      "leaves the 2026 part to the gone answer when no 2026 track is live",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
          });

          expect(
            yield* readTryoutRedirect(
              "/en/try-out/snbt/2026-set-1/part/english-language"
            )
          ).toBeNull();
        })
    );

    it.effect.each([
      [
        "/en/try-out/snbt/2027-set-1/part/english-language",
        "/en/try-out/indonesia/snbt/2027/set-1/literacy-in-english",
        {
          appLocale: "en",
          publicPath: "try-out/indonesia/snbt/2027/set-1/literacy-in-english",
        },
      ],
      [
        "/de/try-out/snbt/2027-set-1/part/englische-sprache",
        "/de/try-out/indonesien/snbt/2027/aufgabensatz-1/lesekompetenz-in-englischer-sprache",
        {
          appLocale: "de",
          publicPath:
            "try-out/indonesien/snbt/2027/aufgabensatz-1/lesekompetenz-in-englischer-sprache",
        },
      ],
    ] as const)(
      "redirects %s to its renamed section once the section page is live",
      ([pathname, expected, section]) =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
            sections: [section],
          });

          expect(yield* readTryoutRedirect(pathname)).toBe(expected);
        })
    );

    it.effect("waits until the renamed section page is a visible page", () =>
      Effect.gen(function* () {
        serveCatalog({
          exams: SNBT_EXAM_PAGES,
          routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
        });

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/snbt/2027-set-1/part/english-language"
          )
        ).toBeNull();
      })
    );

    it.effect(
      "waits until the localized set is live before a renamed part",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM],
            sections: [
              {
                appLocale: "en",
                publicPath:
                  "try-out/indonesia/snbt/2027/set-1/literacy-in-english",
              },
            ],
          });

          expect(
            yield* readTryoutRedirect(
              "/en/try-out/snbt/2027-set-1/part/english-language"
            )
          ).toBeNull();
        })
    );

    it.effect("keeps a retired part path that the catalog still serves", () =>
      Effect.gen(function* () {
        serveCatalog({
          exams: SNBT_EXAM_PAGES,
          routes: [
            SNBT_EXAM,
            SNBT_2027_TRACK,
            SNBT_2027_SET_1,
            { en: "try-out/snbt/2027-set-1/part/english-language" },
          ],
          sections: [
            {
              appLocale: "en",
              publicPath:
                "try-out/indonesia/snbt/2027/set-1/literacy-in-english",
            },
          ],
        });

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/snbt/2027-set-1/part/english-language"
          )
        ).toBeNull();
      })
    );

    it.effect("keeps a part key that the rename map does not rename", () =>
      Effect.gen(function* () {
        serveCatalog({
          exams: SNBT_EXAM_PAGES,
          routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
          sections: [
            {
              appLocale: "en",
              publicPath: "try-out/indonesia/snbt/2027/set-1/matematika-wajib",
            },
          ],
        });

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/snbt/2027-set-1/part/matematika-wajib"
          )
        ).toBe("/en/try-out/indonesia/snbt/2027/set-1/matematika-wajib");
      })
    );
  });

  describe("retired track-less set URLs", () => {
    it.effect(
      "redirects a track-less set to the newest live year track that serves it",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
          ).toBe("/en/try-out/indonesia/snbt/2027/set-1");
        })
    );

    it.effect(
      "prefers the newest year track that serves the set over an older one",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: [
              {
                appLocale: "en",
                publicPath: "try-out/indonesia/snbt",
                tracks: [
                  {
                    publicPath: "try-out/indonesia/snbt/2026",
                    trackKey: "2026",
                    trackKind: "year",
                  },
                  {
                    publicPath: "try-out/indonesia/snbt/2027",
                    trackKey: "2027",
                    trackKind: "year",
                  },
                ],
              },
            ],
            routes: [SNBT_EXAM, SNBT_2026_TRACK, SNBT_2026_SET_1],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
          ).toBe("/en/try-out/indonesia/snbt/2026/set-1");
        })
    );

    it.effect(
      "keeps a track-less set on the 404 when the SNBT exam is not live",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
          ).toBeNull();
          expect(readExamPageMock).toHaveBeenCalledWith({
            appLocale: "en",
            publicPath: "try-out/indonesia/snbt",
          });
        })
    );

    it.effect.each([
      [
        "no track serves the set",
        SNBT_EXAM_PAGES,
        [SNBT_EXAM, SNBT_2027_TRACK],
      ],
      [
        "two live tracks share the newest year",
        [
          {
            appLocale: "en",
            publicPath: "try-out/indonesia/snbt",
            tracks: [
              {
                publicPath: "try-out/indonesia/snbt/2027",
                trackKey: "2027",
                trackKind: "year",
              },
              {
                publicPath: "try-out/indonesia/snbt/2027-ulang",
                trackKey: "2027",
                trackKind: "year",
              },
            ],
          },
        ],
        [
          SNBT_EXAM,
          SNBT_2027_TRACK,
          SNBT_2027_SET_1,
          { en: "try-out/indonesia/snbt/2027-ulang/set-1" },
        ],
      ],
      [
        "only a subject track serves the set",
        [
          {
            appLocale: "en",
            publicPath: "try-out/indonesia/snbt",
            tracks: [
              {
                publicPath: "try-out/indonesia/snbt/matematika",
                trackKey: "matematika",
                trackKind: "subject",
              },
            ],
          },
        ],
        [SNBT_EXAM, { en: "try-out/indonesia/snbt/matematika/set-1" }],
      ],
    ] as const)(
      "keeps a track-less set on the 404 when %s",
      ([_reason, exams, routes]) =>
        Effect.gen(function* () {
          serveCatalog({ exams, routes: [...routes] });

          expect(
            yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
          ).toBeNull();
        })
    );

    it.effect(
      "keeps a track-less set when its retired path is still served",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [
              SNBT_EXAM,
              SNBT_2027_TRACK,
              SNBT_2027_SET_1,
              { en: "try-out/indonesia/snbt/set-1" },
            ],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
          ).toBeNull();
        })
    );

    it.effect(
      "redirects a track-less section to its renamed section in the newest live track",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
            sections: [
              {
                appLocale: "en",
                publicPath:
                  "try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing",
              },
            ],
          });

          expect(
            yield* readTryoutRedirect(
              "/en/try-out/indonesia/snbt/set-1/reading-and-writing-skills"
            )
          ).toBe(
            "/en/try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing"
          );
        })
    );

    it.effect(
      "waits until the renamed track-less section is a visible page",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_TRACK, SNBT_2027_SET_1],
          });

          expect(
            yield* readTryoutRedirect(
              "/en/try-out/indonesia/snbt/set-1/reading-and-writing-skills"
            )
          ).toBeNull();
        })
    );

    it.effect(
      "keeps a track-less section when no year track serves its set",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM],
            sections: [
              {
                appLocale: "en",
                publicPath:
                  "try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing",
              },
            ],
          });

          expect(
            yield* readTryoutRedirect(
              "/en/try-out/indonesia/snbt/set-1/reading-and-writing-skills"
            )
          ).toBeNull();
        })
    );

    it.effect(
      "keeps a track-less section when its retired path is still served",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [
              SNBT_EXAM,
              SNBT_2027_TRACK,
              SNBT_2027_SET_1,
              { en: "try-out/indonesia/snbt/set-1/reading-and-writing-skills" },
            ],
            sections: [
              {
                appLocale: "en",
                publicPath:
                  "try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing",
              },
            ],
          });

          expect(
            yield* readTryoutRedirect(
              "/en/try-out/indonesia/snbt/set-1/reading-and-writing-skills"
            )
          ).toBeNull();
        })
    );
  });

  it.effect.each([
    "/id/try-out/indonesia/tka/bahasa-inggris/set-1",
    "/id/try-out/indonesia/snbt/2027/set-1/penalaran-umum",
    "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris/extra",
    "/fr/try-out/indonesia/snbt/2027/set-1/bahasa-inggris",
    "/en/articles/politics/bahasa-inggris",
    "/id",
    "/en/try-out/indonesia/snbt",
    "/en/try-out/indonesia/snbt/2027",
    "/en/try-out/indonesia/snbt/2027/set-1",
    "/en/try-out/indonesia/tka/matematika-wajib/set-1",
    "/en/try-out/snbt/2027-set-1/extra",
    "/fr/try-out/snbt",
  ])("leaves %s alone without reading the catalog", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readTryoutRedirect(pathname)).toBeNull();
      expect(readLocalizedPathMock).not.toHaveBeenCalled();
      expect(readExamPageMock).not.toHaveBeenCalled();
      expect(readSectionPageMock).not.toHaveBeenCalled();
    })
  );
});
