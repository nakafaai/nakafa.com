import { describe, expect, it } from "vitest";
import {
  getCurriculumIndexHref,
  getCurriculumProgramHref,
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
});
