import { describe, expect, it } from "@effect/vitest";
import {
  getCurriculumIndexHref,
  getCurriculumProgramHref,
  getCurriculumProgramTarget,
  isRenderableCurriculumView,
} from "@/lib/curriculum/routes";

describe("curriculum route helpers", () => {
  it("owns a page only for a renderable level on the sitemap", () => {
    expect(isRenderableCurriculumView({ level: "track", sitemap: true })).toBe(
      true
    );
    expect(isRenderableCurriculumView({ level: "track", sitemap: false })).toBe(
      false
    );
  });

  it("returns localized curriculum index paths", () => {
    expect(getCurriculumIndexHref("en")).toBe("/curriculum");
    expect(getCurriculumIndexHref("id")).toBe("/kurikulum");
  });

  it("returns localized curriculum program root paths", () => {
    expect(
      getCurriculumProgramHref({
        locale: "id",
        publicSlug: "amerika-serikat",
      })
    ).toBe("/kurikulum/amerika-serikat");
  });

  it("types a curriculum program root as its route target, on the locale of the page", () => {
    expect(getCurriculumProgramTarget("vereinigte-staaten")).toEqual({
      from: "/$locale",
      params: { _splat: "", curriculum: "vereinigte-staaten" },
      to: "/$locale/curricula/$curriculum/$",
    });
  });
});
