import {
  preservedProgramCatalogTableNames,
  resettableTableNames,
} from "@repo/backend/convex/contentSync/reset/spec";
import { describe, expect, it } from "vitest";

describe("contentSync/reset spec", () => {
  it("resets derived coverage while preserving referenced program catalog rows", () => {
    expect(resettableTableNames).toContain("learningProgramCoverage");
    expect(resettableTableNames).not.toContain("learningPrograms");
    expect(resettableTableNames).not.toContain("learningProgramSources");
    expect(resettableTableNames).not.toContain("learningProgramOutlineNodes");
    expect(resettableTableNames).not.toContain("learningProgramOutcomes");
    expect(resettableTableNames).not.toContain(
      "learningProgramOutcomeConcepts"
    );
    expect(preservedProgramCatalogTableNames).toEqual([
      "learningPrograms",
      "learningProgramSources",
      "learningProgramOutlineNodes",
      "learningProgramOutcomes",
      "learningProgramOutcomeConcepts",
    ]);
  });
});
