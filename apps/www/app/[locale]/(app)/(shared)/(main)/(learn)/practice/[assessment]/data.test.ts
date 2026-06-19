// @vitest-environment node

import {
  AbsoluteIcon,
  BookEditIcon,
  Brain02Icon,
  ChatQuestionIcon,
  File01Icon,
  LanguageSkillIcon,
  PuzzleIcon,
  SwatchIcon,
} from "@hugeicons/core-free-icons";
import { getCategoryIcon } from "@repo/contents/_lib/assessment/icons";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { describe, expect, it } from "vitest";

describe("practice program route data", () => {
  it("resolves canonical practice program roots from projected set rows", async () => {
    const { getPracticeProgramData, listPracticeProgramStaticParams } =
      await import("./data");
    const data = await getPracticeProgramData(
      Promise.resolve({ assessment: "snbt", locale: "id" })
    );

    expect(data).toMatchObject({
      assessmentPath: "/id/latihan/snbt",
      locale: "id",
      publicPath: "latihan/snbt",
      sourceCategory: "high-school",
      sourceType: "snbt",
    });
    expect(getCategoryIcon(data.sourceCategory)).toBe(SwatchIcon);
    expect(data.domains).toEqual([
      {
        href: "/id/latihan/snbt/pengetahuan-kuantitatif",
        sourceMaterial: "quantitative-knowledge",
      },
      {
        href: "/id/latihan/snbt/penalaran-matematika",
        sourceMaterial: "mathematical-reasoning",
      },
      {
        href: "/id/latihan/snbt/penalaran-umum",
        sourceMaterial: "general-reasoning",
      },
      {
        href: "/id/latihan/snbt/bahasa-indonesia",
        sourceMaterial: "indonesian-language",
      },
      {
        href: "/id/latihan/snbt/bahasa-inggris",
        sourceMaterial: "english-language",
      },
      {
        href: "/id/latihan/snbt/pengetahuan-umum",
        sourceMaterial: "general-knowledge",
      },
      {
        href: "/id/latihan/snbt/literasi-membaca-menulis",
        sourceMaterial: "reading-and-writing-skills",
      },
    ]);
    expect(
      data.domains.map((domain) => getMaterialIcon(domain.sourceMaterial))
    ).toEqual([
      AbsoluteIcon,
      PuzzleIcon,
      Brain02Icon,
      ChatQuestionIcon,
      LanguageSkillIcon,
      BookEditIcon,
      File01Icon,
    ]);
    expect(data.alternatePaths).toEqual(
      expect.arrayContaining([
        { locale: "id", publicPath: "latihan/snbt" },
        { locale: "en", publicPath: "practice/snbt" },
      ])
    );
    expect(listPracticeProgramStaticParams("en")).toEqual(
      expect.arrayContaining([{ assessment: "snbt" }])
    );
    expect(listPracticeProgramStaticParams()).toEqual(
      expect.arrayContaining([{ assessment: "snbt" }])
    );
  });

  it("rejects practice program roots without mapped set rows", async () => {
    const { getPracticeProgramData } = await import("./data");

    await expect(
      getPracticeProgramData(
        Promise.resolve({ assessment: "unknown-assessment", locale: "en" })
      )
    ).rejects.toThrow();
  });
});
