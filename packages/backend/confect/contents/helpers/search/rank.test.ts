import { describe, expect, it } from "@effect/vitest";
import {
  type ContentSearchRankDocument,
  matchesContentSearchQuery,
  rankContentSearchDocuments,
} from "@repo/backend/confect/contents/helpers/search/rank";
import { Array as Arr } from "effect";

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
  it("preserves input order for punctuation-only queries and equal evidence", () => {
    const rows = Arr.map(["first", "second"], (sourcePath) =>
      createSearchRow({
        route: "same-route",
        sourcePath,
      })
    );
    expect(rankContentSearchDocuments(rows, "!!!")).toBe(rows);
    expect(rankContentSearchDocuments(rows, "linear")).toEqual(rows);
  });

  it("uses metadata then body numbers to distinguish otherwise equal topic matches", () => {
    const metadata = createSearchRow({
      route: "material/algebra-11",
      sourcePath: "metadata",
      title: "Algebra",
      description: "",
      text: "algebra",
    });
    const body = createSearchRow({
      route: "material/algebra",
      sourcePath: "body",
      title: "Algebra",
      description: "",
      text: "algebra grade 11",
    });
    const other = createSearchRow({
      route: "material/algebra",
      sourcePath: "other",
      title: "Algebra",
      description: "",
      text: "algebra grade 10",
    });
    expect(
      rankContentSearchDocuments([other, body, metadata], "algebra 11")
    ).toEqual([metadata, body, other]);
  });

  it("matches complete terms and the final search prefix", () => {
    expect(
      matchesContentSearchQuery(
        "Composition of linear functions",
        "linear func"
      )
    ).toBe(true);
    expect(
      matchesContentSearchQuery(
        "Composition of nonlinear functions",
        "linear func"
      )
    ).toBe(false);
    expect(
      matchesContentSearchQuery("Composition of linear functions", "linear z")
    ).toBe(false);
    expect(matchesContentSearchQuery("Linear functions", "!!!")).toBe(false);
  });
  it("orders equal metadata by actual topic evidence in the body", () => {
    const related = createSearchRow({
      route: "same",
      sourcePath: "related",
      text: "linear functions",
    });
    const unrelated = createSearchRow({
      route: "same",
      sourcePath: "unrelated",
      text: "geometric shapes",
    });
    expect(rankContentSearchDocuments([unrelated, related], "linear")).toEqual([
      related,
      unrelated,
    ]);
  });

  it("keeps source try-out section metadata ahead of generic body hits", () => {
    const sectionRow = createSearchRow({
      description: "SNBT mathematical reasoning.",
      route: "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning",
      sourcePath: "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning",
      title: "SNBT Mathematical Reasoning Set 1",
    });
    const genericRow = createSearchRow({
      route: "try-out/indonesia/snbt/2027/set-1/literacy-in-indonesian",
      sourcePath: "try-out/indonesia/snbt/2027/set-1/literacy-in-indonesian",
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
      route: "try-out/indonesia/tka/compulsory-mathematics/set-1",
      sourcePath: "try-out/indonesia/tka/compulsory-mathematics/set-1",
      text: "rational functions for grade 11",
      title: "TKA Compulsory Mathematics",
    });

    expect(
      rankContentSearchDocuments(
        [numericRow, topicRow],
        "rational functions grade 11"
      )
    ).toEqual([topicRow]);
  });
});
