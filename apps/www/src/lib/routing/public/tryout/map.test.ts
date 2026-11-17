// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { readTryoutMap, TryoutMapJson } from "@/lib/routing/public/tryout/map";

const catalog = vi.hoisted(() => ({
  country: vi.fn(),
  exam: vi.fn(),
  group: vi.fn(),
  hub: vi.fn(),
  localized: vi.fn(),
}));

vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutCountryPage: catalog.country,
  readTryoutHubPage: catalog.hub,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: catalog.exam,
  readPublishedTryoutGroupPage: catalog.group,
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: catalog.localized,
}));

const SNBT = "try-out/indonesia/snbt";
const YEAR = `${SNBT}/2027`;
const TRACK = `${YEAR}/utbk`;
const SET = `${TRACK}/set-1`;
const SECTION = `${SET}/penalaran-umum`;
const RETIRED_EXAM = "try-out/indonesia/retired";
const RETIRED_GROUP = `${SNBT}/2026`;

/** The prerendered try-out pages of one locale, with the locale. */
const pages = (locale: string) => [
  `/${locale}/try-out/indonesia`,
  `/${locale}/${YEAR}`,
  `/${locale}/${TRACK}`,
  `/${locale}/${SET}`,
  `/${locale}/${SECTION}`,
];

beforeEach(() => {
  catalog.hub.mockReset().mockReturnValue(
    Effect.succeed({
      countries: [
        {
          countryCode: "ID",
          countryKey: "indonesia",
          publicPath: "try-out/indonesia",
        },
        { countryCode: "XX", countryKey: "gone", publicPath: "try-out/gone" },
      ],
    })
  );
  catalog.country
    .mockReset()
    .mockImplementation((_locale: string, path: string) =>
      Effect.succeed(
        path === "try-out/indonesia"
          ? Option.some({
              exams: [{ publicPath: SNBT }, { publicPath: RETIRED_EXAM }],
            })
          : Option.none()
      )
    );
  catalog.exam
    .mockReset()
    .mockImplementation(({ publicPath }: { publicPath: string }) =>
      Effect.succeed(
        publicPath === SNBT
          ? {
              exam: { examKey: "snbt", groupAxis: "year" },
              groups: [
                {
                  entryPath: TRACK,
                  groupKey: "2027",
                  publicPath: YEAR,
                  title: "2027",
                },
                {
                  entryPath: RETIRED_GROUP,
                  groupKey: "2026",
                  publicPath: RETIRED_GROUP,
                  title: "2026",
                },
              ],
            }
          : null
      )
    );
  catalog.group
    .mockReset()
    .mockImplementation(({ publicPath }: { publicPath: string }) =>
      Effect.succeed(
        publicPath === YEAR
          ? { tracks: [{ publicPath: TRACK, trackKey: "utbk" }] }
          : null
      )
    );
  catalog.localized
    .mockReset()
    .mockImplementation(
      ({
        publicPath,
        targetAppLocale,
      }: {
        publicPath: string;
        targetAppLocale: string;
      }) =>
        Effect.succeed(publicPath === SET ? `${SET}-${targetAppLocale}` : null)
    );
});

describe("readTryoutMap", () => {
  it.effect(
    "writes what the redirects read of each locale's catalog as one asset",
    () =>
      Effect.gen(function* () {
        const file = yield* readTryoutMap([
          ...pages("en"),
          ...pages("id"),
          "/en/articles/politics",
        ]);
        const map = yield* Schema.decodeEffect(TryoutMapJson)(file.text);

        expect(file.path).toBe("_moved/tryout.json");
        expect(map.id).toEqual({
          countries: [
            { countryCode: "ID", publicPath: "try-out/indonesia" },
            { countryCode: "XX", publicPath: "try-out/gone" },
          ],
          exams: {
            [SNBT]: {
              exam: { groupAxis: "year" },
              groups: [
                { entryPath: TRACK, groupKey: "2027", publicPath: YEAR },
                {
                  entryPath: RETIRED_GROUP,
                  groupKey: "2026",
                  publicPath: RETIRED_GROUP,
                },
              ],
            },
          },
          groups: { [YEAR]: [TRACK] },
          localized: { [SET]: `${SET}-id`, [SNBT]: null },
          paths: [
            SNBT,
            YEAR,
            RETIRED_GROUP,
            "try-out/indonesia",
            TRACK,
            SET,
            SECTION,
          ],
          sections: [SECTION],
        });
        expect(map.de?.paths).toEqual([SNBT, YEAR, RETIRED_GROUP]);
      })
  );
});
