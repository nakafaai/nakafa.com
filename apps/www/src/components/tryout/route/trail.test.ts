// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  buildCountryTrail,
  buildTryoutTrail,
} from "@/components/tryout/route/trail";

const COUNTRY = "try-out/indonesia";
const SNBT = "try-out/indonesia/snbt";
const YEAR = "try-out/indonesia/snbt/2027";
const UTBK = "try-out/indonesia/snbt/2027/utbk";
const TKA = "try-out/indonesia/tka";
const GRADE = "try-out/indonesia/tka/senior-high-school";

type TrailInput = Parameters<typeof buildTryoutTrail>[0];

const countries: TrailInput["countries"] = [
  {
    countryCode: "ID",
    countryKey: "indonesia",
    examCount: 2,
    publicPath: COUNTRY,
    title: "Indonesia",
  },
  {
    countryCode: "DE",
    countryKey: "germany",
    examCount: 1,
    publicPath: "try-out/germany",
    title: "Germany",
  },
];
const exams: TrailInput["exams"] = [
  {
    entryPath: UTBK,
    examKey: "snbt",
    groupAxis: "year",
    publicPath: SNBT,
    title: "SNBT",
  },
  {
    entryPath: GRADE,
    examKey: "tka",
    groupAxis: "grade",
    publicPath: TKA,
    title: "TKA",
  },
];
/** SNBT's one group is a year, so its crumb names the year and no group crumb shows. */
const yearPage: TrailInput["page"] = {
  exam: { examKey: "snbt", groupAxis: "year", publicPath: SNBT, title: "SNBT" },
  group: { groupKey: "2027", publicPath: YEAR, title: "2027" },
  groups: [
    { entryPath: UTBK, groupKey: "2027", publicPath: YEAR, title: "2027" },
  ],
  tracks: [
    { groupKey: "2027", publicPath: UTBK, title: "UTBK", trackKey: "utbk" },
  ],
};
/** TKA's group is a grade, which the learner picks, so its crumb shows even alone. */
const gradePage: TrailInput["page"] = {
  exam: { examKey: "tka", groupAxis: "grade", publicPath: TKA, title: "TKA" },
  group: {
    groupKey: "senior-high-school",
    publicPath: GRADE,
    title: "Senior High School",
  },
  groups: [
    {
      entryPath: GRADE,
      groupKey: "senior-high-school",
      publicPath: GRADE,
      title: "Senior High School",
    },
  ],
  tracks: [],
};

const countryOptions = [
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
const examOptions = [
  { entryPath: UTBK, examKey: "snbt", title: "SNBT", value: SNBT },
  { entryPath: GRADE, examKey: "tka", title: "TKA", value: TKA },
];

describe("buildCountryTrail", () => {
  it("offers every country, the page's own current", () => {
    expect(buildCountryTrail(countries, COUNTRY)).toStrictEqual({
      country: { current: COUNTRY, options: countryOptions },
    });
  });
});

describe("buildTryoutTrail", () => {
  it("names a single year in the exam's crumb, with no group crumb, and offers the group's tracks", () => {
    expect(
      buildTryoutTrail({
        countries,
        countryPath: COUNTRY,
        exams,
        page: yearPage,
        trackPath: UTBK,
      })
    ).toStrictEqual({
      country: { current: COUNTRY, options: countryOptions },
      exam: { current: SNBT, label: "SNBT 2027", options: examOptions },
      track: {
        current: UTBK,
        options: [{ title: "UTBK", trackKey: "utbk", value: UTBK }],
      },
    });
  });

  it("keeps a grade the learner picks as its own crumb, and a group page has no track crumb", () => {
    expect(
      buildTryoutTrail({
        countries,
        countryPath: COUNTRY,
        exams,
        page: gradePage,
      })
    ).toStrictEqual({
      country: { current: COUNTRY, options: countryOptions },
      exam: { current: TKA, label: "TKA", options: examOptions },
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
    });
  });
});
