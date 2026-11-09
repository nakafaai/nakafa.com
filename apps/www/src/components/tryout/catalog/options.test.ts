import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  buildTryoutCountryOptions,
  buildTryoutGroupOptions,
  offersGroupChoice,
} from "@/components/tryout/catalog/options";

describe("try-out catalog options", () => {
  it("projects the active localized countries without static source lookup", () => {
    expect(
      buildTryoutCountryOptions([
        {
          countryCode: "DE",
          countryKey: "germany",
          description: "German exams",
          exams: [],
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
});
