import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
  buildTryoutGroupOptions,
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

  it("projects the groups of an exam, each to its own page", () => {
    expect(
      buildTryoutGroupOptions([
        {
          description: "Sekolah menengah atas",
          groupKey: "senior-high-school",
          publicPath: "try-out/indonesia/tka/sma-ma-smk",
          title: "SMA/MA/SMK",
        },
      ])
    ).toEqual([
      {
        groupKey: "senior-high-school",
        title: "SMA/MA/SMK",
        value: "try-out/indonesia/tka/sma-ma-smk",
      },
    ]);
  });
});
