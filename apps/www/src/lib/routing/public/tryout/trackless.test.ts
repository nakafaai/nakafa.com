// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";
import {
  type ExamFixture,
  type GroupFixture,
  type RouteIdentity,
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
};
const SNBT_2027: RouteIdentity = {
  de: "try-out/indonesien/snbt/2027",
  en: "try-out/indonesia/snbt/2027",
};
const SNBT_2027_SET_1: RouteIdentity = {
  de: "try-out/indonesien/snbt/2027/utbk/aufgabensatz-1",
  en: "try-out/indonesia/snbt/2027/utbk/set-1",
};
const SNBT_2026: RouteIdentity = { en: "try-out/indonesia/snbt/2026" };
const SNBT_2026_SET_1: RouteIdentity = {
  en: "try-out/indonesia/snbt/2026/utbk/set-1",
};

/** SNBT by year in one locale, with the groups it lists. */
function snbtExam(
  appLocale: "de" | "en",
  groups: ExamFixture["groups"],
  groupAxis: ExamFixture["groupAxis"] = "year"
): ExamFixture {
  return {
    appLocale,
    groupAxis,
    groups,
    publicPath:
      appLocale === "de" ? "try-out/indonesien/snbt" : "try-out/indonesia/snbt",
  };
}

/** One year group of SNBT in one locale, holding the given tracks. */
function year(
  appLocale: "de" | "en",
  key: string,
  trackKeys: readonly string[] = ["utbk"]
): GroupFixture {
  const country = appLocale === "de" ? "indonesien" : "indonesia";
  const publicPath = `try-out/${country}/snbt/${key}`;
  return {
    appLocale,
    publicPath,
    tracks: Arr.map(trackKeys, (track) => ({
      publicPath: `${publicPath}/${track}`,
      trackKey: key,
    })),
  };
}

/** The groups an exam lists, from its year groups. */
const listed = (groups: readonly GroupFixture[]) =>
  Arr.map(groups, (group) => ({
    groupKey: group.publicPath.slice(group.publicPath.lastIndexOf("/") + 1),
    publicPath: group.publicPath,
  }));

const EN_2027 = year("en", "2027");
const DE_2027 = year("de", "2027");
const CATALOG = {
  exams: [snbtExam("en", listed([EN_2027])), snbtExam("de", listed([DE_2027]))],
  groups: [EN_2027, DE_2027],
  routes: [SNBT_EXAM, SNBT_2027, SNBT_2027_SET_1],
};

beforeEach(() => {
  vi.clearAllMocks();
  serveTryoutCatalog(mocks, CATALOG);
});

describe("retired track-less set URLs", () => {
  it.effect(
    "sends a track-less set to the same set in the track of the newest live year, for now",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
        ).toEqual({
          destination: "/en/try-out/indonesia/snbt/2027/utbk/set-1",
          status: 307,
        });
        expect(
          yield* readTryoutRedirect(
            "/de/try-out/indonesien/snbt/aufgabensatz-1"
          )
        ).toEqual({
          destination: "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-1",
          status: 307,
        });
      })
  );

  it.effect(
    "prefers the newest year that serves the set over an older one",
    () =>
      Effect.gen(function* () {
        const older = year("en", "2026");
        serveTryoutCatalog(mocks, {
          exams: [snbtExam("en", listed([older, EN_2027]))],
          groups: [older, EN_2027],
          routes: [SNBT_EXAM, SNBT_2026, SNBT_2026_SET_1],
        });

        expect(
          yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
        ).toEqual({
          destination: "/en/try-out/indonesia/snbt/2026/utbk/set-1",
          status: 307,
        });
      })
  );

  it.effect("keeps a track-less set on the 404 when the exam is not live", () =>
    Effect.gen(function* () {
      serveTryoutCatalog(mocks, { routes: CATALOG.routes });

      expect(
        yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
      ).toBeNull();
      expect(mocks.exam).toHaveBeenCalledWith({
        appLocale: "en",
        publicPath: "try-out/indonesia/snbt",
      });
    })
  );

  it.effect.each([
    ["no year serves the set", CATALOG.exams, CATALOG.groups, [SNBT_EXAM]],
    [
      "the exam is divided by grade",
      [snbtExam("en", listed([EN_2027]), "grade")],
      CATALOG.groups,
      CATALOG.routes,
    ],
    [
      "its one group is no year",
      [snbtExam("en", listed([year("en", "senior-high-school")]))],
      [year("en", "senior-high-school")],
      [{ en: "try-out/indonesia/snbt/senior-high-school/utbk/set-1" }],
    ],
    [
      "the year holds two tracks",
      CATALOG.exams,
      [year("en", "2027", ["utbk", "latihan"])],
      CATALOG.routes,
    ],
    [
      "two live groups share the newest year",
      [
        snbtExam("en", [
          ...listed([EN_2027]),
          {
            groupKey: "2027",
            publicPath: "try-out/indonesia/snbt/2027-ulang",
          },
        ]),
      ],
      [
        EN_2027,
        {
          appLocale: "en",
          publicPath: "try-out/indonesia/snbt/2027-ulang",
          tracks: [
            {
              publicPath: "try-out/indonesia/snbt/2027-ulang/utbk",
              trackKey: "2027",
            },
          ],
        },
      ],
      [
        ...CATALOG.routes,
        { en: "try-out/indonesia/snbt/2027-ulang/utbk/set-1" },
      ],
    ],
  ] as const)(
    "keeps a track-less set on the 404 when %s",
    ([_reason, exams, groups, routes]) =>
      Effect.gen(function* () {
        serveTryoutCatalog(mocks, { exams, groups, routes });

        expect(
          yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
        ).toBeNull();
      })
  );

  it.effect("keeps a track-less set while its retired path is served", () =>
    Effect.gen(function* () {
      serveTryoutCatalog(mocks, {
        ...CATALOG,
        routes: [...CATALOG.routes, { en: "try-out/indonesia/snbt/set-1" }],
      });

      expect(
        yield* readTryoutRedirect("/en/try-out/indonesia/snbt/set-1")
      ).toBeNull();
    })
  );
});

describe("retired track-less section URLs", () => {
  const SECTION = {
    appLocale: "en",
    publicPath:
      "try-out/indonesia/snbt/2027/utbk/set-1/reading-comprehension-and-writing",
  } as const;

  it.effect(
    "sends a track-less section to its renamed section in the track of the newest live year",
    () =>
      Effect.gen(function* () {
        serveTryoutCatalog(mocks, {
          ...CATALOG,
          sections: [
            SECTION,
            {
              appLocale: "de",
              publicPath:
                "try-out/indonesien/snbt/2027/utbk/aufgabensatz-1/allgemeines-wissen-und-verstaendnis",
            },
          ],
        });

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/indonesia/snbt/set-1/reading-and-writing-skills"
          )
        ).toEqual({
          destination: `/en/${SECTION.publicPath}`,
          status: 307,
        });
        expect(
          yield* readTryoutRedirect(
            "/de/try-out/indonesien/snbt/aufgabensatz-1/allgemeinwissen"
          )
        ).toEqual({
          destination:
            "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-1/allgemeines-wissen-und-verstaendnis",
          status: 307,
        });
      })
  );

  it.effect.each([
    ["the renamed section is no visible page", CATALOG.routes, []],
    ["no year serves its set", [SNBT_EXAM], [SECTION]],
    [
      "its retired path is still served",
      [
        ...CATALOG.routes,
        { en: "try-out/indonesia/snbt/set-1/reading-and-writing-skills" },
      ],
      [SECTION],
    ],
  ] as const)(
    "keeps a track-less section on the 404 when %s",
    ([_reason, routes, sections]) =>
      Effect.gen(function* () {
        serveTryoutCatalog(mocks, { ...CATALOG, routes, sections });

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/indonesia/snbt/set-1/reading-and-writing-skills"
          )
        ).toBeNull();
      })
  );
});
