import { describe, expect, it } from "@effect/vitest";
import {
  getCurriculumIndexHref,
  getCurriculumProgramHref,
  getCurriculumProgramTarget,
} from "@/lib/curriculum/routes";

describe("curriculum route helpers", () => {
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
