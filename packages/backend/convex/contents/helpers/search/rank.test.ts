import {
  type ContentSearchRankDocument,
  rankContentSearchDocuments,
} from "@repo/backend/convex/contents/helpers/search/rank";
import { describe, expect, it } from "vitest";

/** Builds a persisted search row slice for rank tests without Convex IDs. */
function createSearchRow(
  row: Pick<ContentSearchRankDocument, "route" | "sourcePath">
): ContentSearchRankDocument {
  return {
    description: "SNBT quantitative practice.",
    locale: "en",
    route: row.route,
    section: "material",
    sourcePath: row.sourcePath,
    text: "linear equations and arithmetic reasoning",
    title: "Tryout 2026 Set 1",
  };
}

describe("rankContentSearchDocuments", () => {
  it("keeps source practice set rows ahead of numeric question rows", () => {
    const setRow = createSearchRow({
      route: "practice/snbt/quantitative-knowledge/tryout-2026/set-1",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    const questionRow = createSearchRow({
      route:
        "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
    });

    expect(
      rankContentSearchDocuments([questionRow, setRow], "tryout quantitative")
    ).toEqual([setRow, questionRow]);
  });
});
