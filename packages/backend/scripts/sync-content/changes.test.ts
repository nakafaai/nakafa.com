import { readSyncContentFileChanges } from "@repo/backend/scripts/sync-content/changes";
import { describe, expect, it } from "vitest";

describe("readSyncContentFileChanges", () => {
  it("rebuilds route artifacts when route projection modules change", () => {
    expect(
      readSyncContentFileChanges([
        "packages/contents/_types/route/practice/path.ts",
      ])
    ).toMatchObject({
      hasArticleChanges: false,
      hasContentRouteChanges: true,
      hasCurriculumMaterialChanges: false,
      hasExerciseChanges: false,
      hasMaterialChanges: false,
    });
  });
});
