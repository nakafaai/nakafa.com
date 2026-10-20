import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
} from "@/components/tryout/catalog/options";

describe("try-out catalog options", () => {
  it("projects the active localized countries without static source lookup", () => {
    expect(
      buildTryoutCountryOptions("en", [
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
        href: "/en/try-out/germany",
        publicPath: "try-out/germany",
        title: "Germany",
        value: "try-out/germany",
      },
    ]);
  });

  it("projects the active localized exams without static source lookup", () => {
    expect(
      buildTryoutExamOptions("id", [
        {
          description: "Ujian baru",
          examKey: "ujian-baru",
          publicPath: PublicPathSchema.make("try-out/indonesia/ujian-baru"),
          scoringStrategy: "irt",
          title: "Ujian Baru",
        },
      ])
    ).toEqual([
      {
        examKey: "ujian-baru",
        href: "/id/try-out/indonesia/ujian-baru",
        title: "Ujian Baru",
        value: "try-out/indonesia/ujian-baru",
      },
    ]);
  });
});
