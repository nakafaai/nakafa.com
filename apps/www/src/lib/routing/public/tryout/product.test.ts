// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";
import {
  type ExamFixture,
  type GroupFixture,
  type RouteIdentity,
  type SectionFixture,
  serveTryoutCatalog,
} from "@/test/catalog";

const mocks = vi.hoisted(() => ({
  exam: vi.fn(),
  group: vi.fn(),
  path: vi.fn(),
  section: vi.fn(),
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: mocks.path,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: mocks.exam,
  readPublishedTryoutGroupPage: mocks.group,
  readPublishedTryoutSectionPage: mocks.section,
}));

const SNBT_EXAM: RouteIdentity = {
  de: "try-out/indonesien/snbt",
  en: "try-out/indonesia/snbt",
  id: "try-out/indonesia/snbt",
};
const SNBT_2027_GROUP: RouteIdentity = {
  de: "try-out/indonesien/snbt/2027",
  en: "try-out/indonesia/snbt/2027",
  id: "try-out/indonesia/snbt/2027",
};
const SNBT_2027_SET_1: RouteIdentity = {
  de: "try-out/indonesien/snbt/2027/utbk/aufgabensatz-1",
  en: "try-out/indonesia/snbt/2027/utbk/set-1",
  id: "try-out/indonesia/snbt/2027/utbk/set-1",
};

/** The English group of one SNBT year, holding its one UTBK track. */
function yearGroup(year: string): GroupFixture {
  return {
    appLocale: "en",
    publicPath: `try-out/indonesia/snbt/${year}`,
    tracks: [
      { publicPath: `try-out/indonesia/snbt/${year}/utbk`, trackKey: year },
    ],
  };
}

const SNBT_EXAM_PAGES: readonly ExamFixture[] = [
  {
    appLocale: "en",
    groupAxis: "year",
    groups: [{ groupKey: "2027", publicPath: "try-out/indonesia/snbt/2027" }],
    publicPath: "try-out/indonesia/snbt",
  },
];

/** Serves one catalog, with SNBT 2027 and its UTBK unless it names its own groups. */
function serveCatalog(fixture: {
  readonly exams?: readonly ExamFixture[];
  readonly groups?: readonly GroupFixture[];
  readonly routes?: readonly RouteIdentity[];
  readonly sections?: readonly SectionFixture[];
}) {
  serveTryoutCatalog(mocks, { groups: [yearGroup("2027")], ...fixture });
}

describe("retired try-out redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
            routes: [SNBT_EXAM, SNBT_2027_GROUP, SNBT_2027_SET_1],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/snbt/2026-set-1")
          ).toBeNull();
        })
    );

    it.effect.each([
      [
        "/en/try-out/snbt/2027-set-1",
        "/en/try-out/indonesia/snbt/2027/utbk/set-1",
      ],
      [
        "/de/try-out/snbt/2027-set-1",
        "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-1",
      ],
    ])("redirects %s to its localized set", ([pathname, expected]) =>
      Effect.gen(function* () {
        serveCatalog({
          exams: SNBT_EXAM_PAGES,
          routes: [SNBT_EXAM, SNBT_2027_GROUP, SNBT_2027_SET_1],
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
            groups: [yearGroup("2028")],
            routes: [{ en: "try-out/indonesia/snbt/2028/utbk/set-1" }],
          });

          expect(
            yield* readTryoutRedirect("/en/try-out/snbt/2028-set-1")
          ).toEqual({
            destination: "/en/try-out/indonesia/snbt/2028/utbk/set-1",
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
              SNBT_2027_GROUP,
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
            routes: [SNBT_EXAM, SNBT_2027_GROUP, SNBT_2027_SET_1],
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
        "/en/try-out/indonesia/snbt/2027/utbk/set-1/literacy-in-english",
        {
          appLocale: "en",
          publicPath:
            "try-out/indonesia/snbt/2027/utbk/set-1/literacy-in-english",
        },
      ],
      [
        "/de/try-out/snbt/2027-set-1/part/englische-sprache",
        "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-1/lesekompetenz-in-englischer-sprache",
        {
          appLocale: "de",
          publicPath:
            "try-out/indonesien/snbt/2027/utbk/aufgabensatz-1/lesekompetenz-in-englischer-sprache",
        },
      ],
    ] as const)(
      "redirects %s to its renamed section once the section page is live",
      ([pathname, expected, section]) =>
        Effect.gen(function* () {
          serveCatalog({
            exams: SNBT_EXAM_PAGES,
            routes: [SNBT_EXAM, SNBT_2027_GROUP, SNBT_2027_SET_1],
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
          routes: [SNBT_EXAM, SNBT_2027_GROUP, SNBT_2027_SET_1],
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
                  "try-out/indonesia/snbt/2027/utbk/set-1/literacy-in-english",
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
            SNBT_2027_GROUP,
            SNBT_2027_SET_1,
            { en: "try-out/snbt/2027-set-1/part/english-language" },
          ],
          sections: [
            {
              appLocale: "en",
              publicPath:
                "try-out/indonesia/snbt/2027/utbk/set-1/literacy-in-english",
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
          routes: [SNBT_EXAM, SNBT_2027_GROUP, SNBT_2027_SET_1],
          sections: [
            {
              appLocale: "en",
              publicPath:
                "try-out/indonesia/snbt/2027/utbk/set-1/matematika-wajib",
            },
          ],
        });

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/snbt/2027-set-1/part/matematika-wajib"
          )
        ).toEqual({
          destination:
            "/en/try-out/indonesia/snbt/2027/utbk/set-1/matematika-wajib",
          status: 308,
        });
      })
    );
  });
});
