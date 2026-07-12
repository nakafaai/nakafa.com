import {
  type ContentSearchRankDocument,
  rankContentSearchDocuments,
} from "@repo/backend/convex/contents/helpers/search/rank";
import { describe, expect, it } from "vitest";

/** Builds a persisted search row slice for rank tests without Convex IDs. */
function createSearchRow(
  row: Pick<ContentSearchRankDocument, "route" | "sourcePath"> &
    Partial<Pick<ContentSearchRankDocument, "description" | "text" | "title">>
): ContentSearchRankDocument {
  return {
    description: row.description ?? "SNBT try-out section.",
    locale: "en",
    route: row.route,
    section: "tryout",
    sourcePath: row.sourcePath,
    text: row.text ?? "linear equations and arithmetic reasoning",
    title: row.title ?? "Tryout 2026 Set 1",
  };
}

describe("rankContentSearchDocuments", () => {
  it("keeps source try-out section metadata ahead of generic body hits", () => {
    const sectionRow = createSearchRow({
      description: "SNBT mathematical reasoning.",
      route: "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning",
      sourcePath: "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning",
      title: "SNBT Mathematical Reasoning Set 1",
    });
    const genericRow = createSearchRow({
      route: "try-out/indonesia/snbt/2027/set-1/indonesian-language",
      sourcePath: "try-out/indonesia/snbt/2027/set-1/indonesian-language",
      text: "linear equations and arithmetic reasoning",
      title: "SNBT Indonesian Language Set 1",
    });

    expect(
      rankContentSearchDocuments(
        [genericRow, sectionRow],
        "mathematical reasoning"
      )
    ).toEqual([sectionRow]);
  });
});
