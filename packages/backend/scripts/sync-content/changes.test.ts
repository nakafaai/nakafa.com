import { readSyncContentFileChanges } from "@repo/backend/scripts/sync-content/changes";
import { describe, expect, it } from "vitest";

describe("readSyncContentFileChanges", () => {
  it("resyncs material and practice rows when route projection modules change", () => {
    expect(
      readSyncContentFileChanges([
        "packages/contents/_types/route/practice/path.ts",
      ])
    ).toMatchObject({
      hasArticleChanges: false,
      hasContentRouteChanges: true,
      hasCurriculumMaterialChanges: true,
      hasExerciseChanges: true,
      hasGeneratedReadModelChanges: true,
      hasMaterialChanges: true,
    });
  });

  it("resyncs every content row surface when graph projection modules change", () => {
    expect(
      readSyncContentFileChanges([
        "packages/contents/_types/graph/projection.ts",
      ])
    ).toMatchObject({
      hasArticleChanges: true,
      hasContentRouteChanges: true,
      hasCurriculumMaterialChanges: true,
      hasExerciseChanges: true,
      hasGeneratedReadModelChanges: true,
      hasMaterialChanges: true,
    });
  });

  it("syncs exercise rows when material practice content changes", () => {
    expect(
      readSyncContentFileChanges([
        "packages/contents/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-1/question.id.mdx",
      ])
    ).toMatchObject({
      hasContentRouteChanges: true,
      hasExerciseChanges: true,
      hasGeneratedReadModelChanges: true,
      hasMaterialChanges: true,
    });
  });
});
