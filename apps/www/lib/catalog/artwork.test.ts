// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  getCurriculumSubjectCatalogArtwork,
  getGradeCatalogArtwork,
  getTryoutSubjectCatalogArtwork,
} from "@/lib/catalog/artwork";

describe("catalog artwork", () => {
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
