import { describe, expect, it } from "vitest";
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
          publicPath: "try-out/germany",
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
          publicPath: "try-out/indonesia/ujian-baru",
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
