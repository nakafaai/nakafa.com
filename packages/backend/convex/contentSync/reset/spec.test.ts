import { resettableTableNames } from "@repo/backend/convex/contentSync/reset/spec";
import { describe, expect, it } from "vitest";

describe("contentSync/reset spec", () => {
  it("resets generated read model rows without deleting selected program identity", () => {
    expect(resettableTableNames).toContain("materials");
    expect(resettableTableNames).toContain("materialLocales");
    expect(resettableTableNames).toContain("curricula");
    expect(resettableTableNames).toContain("curriculumNodes");
    expect(resettableTableNames).toContain("curriculumMaterials");
    expect(resettableTableNames).toContain("assessments");
    expect(resettableTableNames).toContain("assessmentNodes");
    expect(resettableTableNames).toContain("learningProgramCoverage");
    expect(resettableTableNames).toContain("learningPlanItems");
    expect(resettableTableNames).not.toContain("learningPrograms");
    expect(resettableTableNames).not.toContain("learningProgramSources");
  });
});
