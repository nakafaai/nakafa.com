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

  describe("retired SNBT exam URL", () => {
    it.effect.each([
      ["/en/try-out/snbt", "/en/try-out/indonesia/snbt"],
      ["/de/try-out/snbt", "/de/try-out/indonesien/snbt"],
    ])("redirects %s to its localized exam page", ([pathname, expected]) =>
      Effect.gen(function* () {
        serveCatalog({ routes: [SNBT_EXAM] });

        expect(yield* readTryoutRedirect(pathname)).toEqual({
          destination: expected,
          status: 308,
        });
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

        expect(yield* readTryoutRedirect(pathname)).toEqual({
          destination: expected,
          status: 308,
        });
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
      "redirects a product URL of a later year once its localized set is live",
      () =>
        Effect.gen(function* () {
          serveCatalog({
            routes: [{ en: "try-out/indonesia/snbt/2028/set-1" }],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/snbt/2028-set-1")
          ).toEqual({
            destination: "/en/try-out/indonesia/snbt/2028/set-1",
            status: 308,
          });
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

          expect(yield* readTryoutRedirect(pathname)).toEqual({
            destination: expected,
            status: 308,
          });
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
        ).toEqual({
          destination: "/en/try-out/indonesia/snbt/2027/set-1/matematika-wajib",
          status: 308,
        });
      })
    );
  });
});
