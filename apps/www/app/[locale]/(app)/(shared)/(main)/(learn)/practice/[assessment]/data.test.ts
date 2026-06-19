// @vitest-environment node

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
      sourceType: "snbt",
    });
    expect(data.domains).toEqual(
      expect.arrayContaining([
        {
          href: "/id/latihan/snbt/pengetahuan-kuantitatif",
          sourceMaterial: "quantitative-knowledge",
        },
        {
          href: "/id/latihan/snbt/penalaran-matematika",
          sourceMaterial: "mathematical-reasoning",
        },
      ])
    );
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
