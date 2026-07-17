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

  it("does not let numeric metadata outrank semantic topic matches", () => {
    const numericRow = createSearchRow({
      description: "Grade 11 try-out set 11 question 11.",
      route: "try-out/indonesia/snbt/2027/set-11/general-reasoning",
      sourcePath: "try-out/indonesia/snbt/2027/set-11/general-reasoning",
      text: "general reasoning practice",
      title: "General Reasoning 11",
    });
    const topicRow = createSearchRow({
      route: "try-out/indonesia/tka/mathematics/set-1",
      sourcePath: "try-out/indonesia/tka/mathematics/set-1",
      text: "rational functions for grade 11",
      title: "TKA Mathematics",
    });

    expect(
      rankContentSearchDocuments(
        [numericRow, topicRow],
        "rational functions grade 11"
      )
    ).toEqual([topicRow]);
  });
});
