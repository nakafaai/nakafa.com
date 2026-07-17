import { resettableTableNames } from "@repo/backend/convex/contentSync/reset/spec";
import { describe, expect, it } from "vitest";

describe("contentSync/reset spec", () => {
  it("resets derived rows without deleting selected program identity", () => {
    expect(resettableTableNames).toContain("learningProgramCoverage");
    expect(resettableTableNames).toContain("learningPlanItems");
    expect(resettableTableNames).toContain("publicRouteSitemapCounts");
    expect(resettableTableNames).toContain("publicRouteSitemapPages");
    expect(resettableTableNames).toContain("publicRouteSyncState");
    expect(resettableTableNames).not.toContain("learningPrograms");
    expect(resettableTableNames).not.toContain("learningProgramSources");
    expect(resettableTableNames).not.toContain("learningViews");
    expect(resettableTableNames).not.toContain("userLearningRecents");
  });
});
