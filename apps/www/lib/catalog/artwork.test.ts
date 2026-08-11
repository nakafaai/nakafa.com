// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  getGradeCatalogArtwork,
  getSubjectCatalogArtwork,
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
  });

  it("resolves reviewed subject artwork in both locales", () => {
    expect(getSubjectCatalogArtwork("en", "mathematics")).toBe(
      "/open-graph/subject/en-mathematics.png"
    );
    expect(getSubjectCatalogArtwork("id", "biology")).toBe(
      "/open-graph/subject/id-biology.png"
    );
  });

  it("keeps subjects without reviewed artwork on gradients", () => {
    expect(getSubjectCatalogArtwork("id", "science")).toBeUndefined();
    expect(getSubjectCatalogArtwork("en", undefined)).toBeUndefined();
  });
});
