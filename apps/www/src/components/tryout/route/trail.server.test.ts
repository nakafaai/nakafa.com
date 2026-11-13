// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readTryoutTrail } from "@/components/tryout/route/trail.server";

const source = vi.hoisted(() => ({
  readTryoutCountryPage: vi.fn(),
  readTryoutGroupPage: vi.fn(),
  readTryoutHubPage: vi.fn(),
}));

vi.mock("@/components/tryout/catalog/source.server", () => source);

const COUNTRY = "try-out/indonesia";
const SNBT = "try-out/indonesia/snbt";
const YEAR = "try-out/indonesia/snbt/2027";
const UTBK = "try-out/indonesia/snbt/2027/utbk";
const TKA = "try-out/indonesia/tka";
const GRADE = "try-out/indonesia/tka/senior-high-school";

const hub = {
  countries: [
    {
      countryCode: "ID",
      countryKey: "indonesia",
      publicPath: COUNTRY,
      title: "Indonesia",
    },
    {
      countryCode: "DE",
      countryKey: "germany",
      publicPath: "try-out/germany",
      title: "Germany",
    },
  ],
};
const countryPage = {
  exams: [
    { entryPath: UTBK, examKey: "snbt", publicPath: SNBT, title: "SNBT" },
    { entryPath: GRADE, examKey: "tka", publicPath: TKA, title: "TKA" },
  ],
};
/** SNBT's one group is a year, so its crumb names the year and no group crumb shows. */
const yearPage = {
  exam: { groupAxis: "year", publicPath: SNBT, title: "SNBT" },
  group: { title: "2027" },
  groups: [
    { entryPath: UTBK, groupKey: "2027", publicPath: YEAR, title: "2027" },
  ],
  tracks: [{ publicPath: UTBK, title: "UTBK", trackKey: "utbk" }],
};
/** TKA's group is a grade, which the learner picks, so its crumb shows even alone. */
const gradePage = {
  exam: { groupAxis: "grade", publicPath: TKA, title: "TKA" },
  group: { title: "Senior High School" },
  groups: [
    {
      entryPath: GRADE,
      groupKey: "senior-high-school",
      publicPath: GRADE,
      title: "Senior High School",
    },
  ],
  tracks: [
    {
      publicPath: `${GRADE}/compulsory-mathematics`,
      title: "Compulsory Mathematics",
      trackKey: "compulsory-mathematics",
    },
    {
      publicPath: `${GRADE}/english-language`,
      title: "English",
      trackKey: "english-language",
    },
  ],
};

const countries = [
  {
    countryCode: "ID",
    countryKey: "indonesia",
    publicPath: COUNTRY,
    title: "Indonesia",
    value: COUNTRY,
  },
  {
    countryCode: "DE",
    countryKey: "germany",
    publicPath: "try-out/germany",
    title: "Germany",
    value: "try-out/germany",
  },
];
const exams = [
  { entryPath: UTBK, examKey: "snbt", title: "SNBT", value: SNBT },
  { entryPath: GRADE, examKey: "tka", title: "TKA", value: TKA },
];

describe("readTryoutTrail", () => {
  beforeEach(() => {
    source.readTryoutHubPage.mockReturnValue(Effect.succeed(hub));
    source.readTryoutCountryPage.mockReturnValue(
      Effect.succeed(Option.some(countryPage))
    );
    source.readTryoutGroupPage.mockImplementation((_locale, path: string) =>
      Effect.succeed(path === YEAR ? yearPage : gradePage)
    );
  });

  it.effect("gives a country page its countries alone", () =>
    Effect.gen(function* () {
      const trail = yield* readTryoutTrail({
        countryPath: COUNTRY,
        locale: "en",
      });

      expect(trail).toStrictEqual(
        Option.some({ country: { current: COUNTRY, options: countries } })
      );
      expect(source.readTryoutGroupPage).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "names a single year in the exam's crumb, with no group crumb, and lists the group's tracks",
    () =>
      Effect.gen(function* () {
        const trail = yield* readTryoutTrail({
          countryPath: COUNTRY,
          groupPath: YEAR,
          locale: "en",
          trackPath: UTBK,
        });

        expect(trail).toStrictEqual(
          Option.some({
            country: { current: COUNTRY, options: countries },
            exam: { current: SNBT, label: "SNBT 2027", options: exams },
            track: {
              current: UTBK,
              options: [{ title: "UTBK", trackKey: "utbk", value: UTBK }],
            },
          })
        );
      })
  );

  it.effect("keeps a grade the learner picks as its own crumb", () =>
    Effect.gen(function* () {
      const trail = yield* readTryoutTrail({
        countryPath: COUNTRY,
        groupPath: GRADE,
        locale: "en",
      });

      expect(trail).toStrictEqual(
        Option.some({
          country: { current: COUNTRY, options: countries },
          exam: { current: TKA, label: "TKA", options: exams },
          group: {
            axis: "grade",
            current: GRADE,
            options: [
              {
                entryPath: GRADE,
                groupKey: "senior-high-school",
                title: "Senior High School",
                value: GRADE,
              },
            ],
          },
        })
      );
    })
  );

  it.effect("has no trail when the catalog holds no such country", () =>
    Effect.gen(function* () {
      source.readTryoutCountryPage.mockReturnValue(
        Effect.succeed(Option.none())
      );

      expect(
        yield* readTryoutTrail({
          countryPath: COUNTRY,
          groupPath: GRADE,
          locale: "en",
        })
      ).toStrictEqual(Option.none());
    })
  );

  it.effect("has no trail when the catalog holds no such group", () =>
    Effect.gen(function* () {
      source.readTryoutGroupPage.mockReturnValue(Effect.succeed(null));

      expect(
        yield* readTryoutTrail({
          countryPath: COUNTRY,
          groupPath: GRADE,
          locale: "en",
        })
      ).toStrictEqual(Option.none());
    })
  );
});
