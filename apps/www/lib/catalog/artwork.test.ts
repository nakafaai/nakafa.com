// @vitest-environment node

import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCurriculumCatalogArtwork,
  getCurriculumSubjectCatalogArtwork,
  getGradeCatalogArtwork,
  getTryoutSubjectCatalogArtwork,
} from "@/lib/catalog/artwork";

const reviewedCurriculumArtworkFixtures = [
  ["en", "cambridge-international"],
  ["en", "merdeka"],
  ["en", "singapore-moe"],
  ["en", "united-states"],
  ["id", "cambridge-international"],
  ["id", "merdeka"],
  ["id", "singapore-moe"],
  ["id", "united-states"],
] as const;

describe("catalog artwork", () => {
  it.each(reviewedCurriculumArtworkFixtures)(
    "resolves existing %s %s curriculum artwork",
    async (locale, programKey) => {
      const expectedPath = `/open-graph/curriculum/${locale}-${programKey}.png`;
      const imagePath = getCurriculumCatalogArtwork(locale, programKey);

      expect(imagePath).toBe(expectedPath);
      await expect(
        access(join(process.cwd(), "public", expectedPath.slice(1)))
      ).resolves.toBeUndefined();
    }
  );

  it("keeps missing curriculum artwork on gradients", () => {
    expect(getCurriculumCatalogArtwork("de", "merdeka")).toBeUndefined();
    expect(getCurriculumCatalogArtwork("en", "future")).toBeUndefined();
  });

  it.each([
    ["en", "grade-9", "/open-graph/grade/en-9.png"],
    ["id", "grade-10", "/open-graph/grade/id-10.png"],
    ["en", "grade-11", "/open-graph/grade/en-11.png"],
    ["id", "grade-12", "/open-graph/grade/id-12.png"],
    ["en", "bachelor", "/open-graph/grade/en-bachelor.png"],
  ] as const)("resolves %s %s artwork", (locale, iconKey, expected) => {
    expect(getGradeCatalogArtwork(locale, iconKey)).toBe(expected);
  });

  it("keeps unsupported curriculum stages on gradient artwork", () => {
    expect(getGradeCatalogArtwork("en", "upper-secondary")).toBeUndefined();
    expect(getGradeCatalogArtwork("de", "grade-10")).toBeUndefined();
  });

  it("maps curriculum material identities to reviewed artwork keys", () => {
    expect(getCurriculumSubjectCatalogArtwork("en", "economy")).toBe(
      "/open-graph/subject/en-economics.png"
    );
    expect(getCurriculumSubjectCatalogArtwork("id", "biology")).toBe(
      "/open-graph/subject/id-biology.png"
    );
  });

  it("maps try-out track identities to reviewed artwork keys", () => {
    expect(getTryoutSubjectCatalogArtwork("id", "matematika")).toBe(
      "/open-graph/subject/id-mathematics.png"
    );
    expect(getTryoutSubjectCatalogArtwork("en", "mathematics")).toBe(
      "/open-graph/subject/en-mathematics.png"
    );
  });

  it("keeps identities without reviewed artwork on gradients", () => {
    expect(getCurriculumSubjectCatalogArtwork("id", "science")).toBeUndefined();
    expect(getCurriculumSubjectCatalogArtwork("en", undefined)).toBeUndefined();
    expect(getTryoutSubjectCatalogArtwork("en", "literacy")).toBeUndefined();
    expect(
      getCurriculumSubjectCatalogArtwork("de", "mathematics")
    ).toBeUndefined();
    expect(getTryoutSubjectCatalogArtwork("de", "mathematics")).toBeUndefined();
  });
});
