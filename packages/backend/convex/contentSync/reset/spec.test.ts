import { resettableTableNames } from "@repo/backend/convex/contentSync/reset/spec";
import { describe, expect, it } from "vitest";

describe("contentSync/reset spec", () => {
  it("resets generated learning program rows with the final read models", () => {
    expect(resettableTableNames).toContain("materials");
    expect(resettableTableNames).toContain("materialLocales");
    expect(resettableTableNames).toContain("curricula");
    expect(resettableTableNames).toContain("curriculumNodes");
    expect(resettableTableNames).toContain("curriculumMaterials");
    expect(resettableTableNames).toContain("assessments");
    expect(resettableTableNames).toContain("assessmentNodes");
    expect(resettableTableNames).toContain("learningProgramCoverage");
    expect(resettableTableNames).toContain("learningPlanItems");
    expect(resettableTableNames).toContain("learningPrograms");
    expect(resettableTableNames).toContain("learningProgramSources");
  });
});
