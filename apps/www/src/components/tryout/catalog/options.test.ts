import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Option } from "effect";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
  buildTryoutGroupOptions,
  offersGroupChoice,
  readLocaleCountry,
} from "@/components/tryout/catalog/options";

describe("try-out catalog options", () => {
  it("projects the active localized countries without static source lookup", () => {
    expect(
      buildTryoutCountryOptions([
        {
          countryCode: "DE",
          countryKey: "germany",
          description: "German exams",
          examCount: 1,
          publicPath: PublicPathSchema.make("try-out/germany"),
          title: "Germany",
        },
      ])
    ).toEqual([
      {
        countryCode: "DE",
        countryKey: "germany",
        publicPath: "try-out/germany",
        title: "Germany",
        value: "try-out/germany",
      },
    ]);
  });

  it("links each exam to its entry, the first of its groups", () => {
    expect(
      buildTryoutExamOptions([
        {
          description: "Ujian baru",
          entryPath: "try-out/indonesia/ujian-baru/sma-ma-smk",
          examKey: "ujian-baru",
          groupAxis: "grade",
          publicPath: PublicPathSchema.make("try-out/indonesia/ujian-baru"),
          title: "Ujian Baru",
        },
      ])
    ).toEqual([
      {
        entryPath: "try-out/indonesia/ujian-baru/sma-ma-smk",
        examKey: "ujian-baru",
        title: "Ujian Baru",
        value: "try-out/indonesia/ujian-baru",
      },
    ]);
  });

  it("projects the groups of an exam, each landing on its entry", () => {
    expect(
      buildTryoutGroupOptions([
        {
          description: "Sekolah menengah atas",
          entryPath: "try-out/indonesia/tka/sma-ma-smk",
          groupKey: "senior-high-school",
          publicPath: "try-out/indonesia/tka/sma-ma-smk",
          title: "SMA/MA/SMK",
        },
      ])
    ).toEqual([
      {
        entryPath: "try-out/indonesia/tka/sma-ma-smk",
        groupKey: "senior-high-school",
        title: "SMA/MA/SMK",
        value: "try-out/indonesia/tka/sma-ma-smk",
      },
    ]);
  });

  it("offers a learner's own grade or Studienkolleg, and a year only when there is a choice", () => {
    expect(offersGroupChoice("grade", ["sma"])).toBe(true);
    expect(offersGroupChoice("institution", ["tu-darmstadt"])).toBe(true);
    expect(offersGroupChoice("year", ["2027"])).toBe(false);
    expect(offersGroupChoice("year", ["2027", "2028"])).toBe(true);
  });

  it("opens a locale's own country, else the catalog's first", () => {
    const countries = [
      { countryCode: "ID", countryKey: "indonesia" },
      { countryCode: "DE", countryKey: "germany" },
    ];
    const keyOf = (locale: string) =>
      Option.map(readLocaleCountry(locale, countries), (row) => row.countryKey);
    expect(keyOf("de")).toEqual(Option.some("germany"));
    expect(keyOf("id")).toEqual(Option.some("indonesia"));
    expect(keyOf("en")).toEqual(Option.some("indonesia"));
    expect(keyOf("ms")).toEqual(Option.some("indonesia"));
    expect(readLocaleCountry("en", [])).toEqual(Option.none());
  });
});
