import {
  getDistinctiveSearchTerms,
  hasSearchableTerms,
  normalizedSearchTextHasTerm,
  normalizeSearchTerm,
  planSearchQueries,
} from "@repo/ai/lib/search-query";
import { describe, expect, it } from "vitest";

describe("search query planning", () => {
  it("anchors generated queries to exact distinctive task terms", () => {
    expect(
      planSearchQueries({
        anchor: "empty",
        includeShortNumbers: true,
        task: "Aku mau latihan SNBT Pengetahuan Kuantitatif try out 2026 set 2.",
        maxQueries: 4,
        queries: ["Pengetahuan Kuantitatif SNBT"],
      })
    ).toEqual(["2026 2 Pengetahuan Kuantitatif SNBT"]);
  });

  it("uses a concise task anchor when configured for empty query lists", () => {
    expect(
      planSearchQueries({
        anchor: "empty",
        includeShortNumbers: true,
        task: "SNBT 2026 set 2",
        maxQueries: 4,
        queries: [],
      })
    ).toEqual(["SNBT 2026 2"]);
  });

  it("does not create an anchor from non-searchable numeric-only tasks", () => {
    expect(
      planSearchQueries({
        anchor: "empty",
        task: "2026",
        maxQueries: 4,
        queries: [],
      })
    ).toEqual([]);
  });

  it("keeps research-style task anchors separate from generated queries", () => {
    expect(
      planSearchQueries({
        anchor: "always",
        task: "AI SDK DevTools May 2026",
        maxQueries: 2,
        queries: ["AI SDK DevTools", "AI SDK DevTools 2026"],
      })
    ).toEqual(["AI SDK DevTools May 2026", "2026 AI SDK DevTools"]);
  });

  it("keeps lower-case feature phrases in compact research anchors", () => {
    expect(
      planSearchQueries({
        anchor: "always",
        task: "apa yang berubah di next.js 16 cache components buat upgrade?",
        maxQueries: 2,
        queries: ["next.js 16 cache components upgrade"],
      })
    ).toEqual([
      "next.js 16 cache components",
      "next.js 16 cache components upgrade",
    ]);
  });

  it("does not execute internal markdown section labels as search terms", () => {
    expect(
      planSearchQueries({
        anchor: "always",
        task: [
          "# User Request",
          "Untuk migrasi Next.js 16, Cache Components berubah apa menurut pihak pembuat Next.js sendiri?",
          "# Task",
          "Find official Next.js 16 Cache Components changes.",
        ].join("\n\n"),
        maxQueries: 2,
        queries: ["Next.js 16 caching changes official documentation"],
      })
    ).toEqual([
      "Next.js 16 Cache Components",
      "Next.js 16 caching changes official documentation",
    ]);
  });

  it("falls back to heading text only when a task has no body content", () => {
    expect(
      planSearchQueries({
        anchor: "always",
        task: "# SNBT",
        maxQueries: 2,
        queries: [],
      })
    ).toEqual(["SNBT"]);
  });

  it("can disable executable task anchors while still completing query text", () => {
    expect(
      planSearchQueries({
        anchor: "never",
        task: "AI SDK DevTools 2026",
        maxQueries: 4,
        queries: ["AI SDK DevTools", "  ", "ai sdk devtools"],
      })
    ).toEqual(["2026 AI SDK DevTools"]);
  });

  it("can keep existing queries isolated from global task terms", () => {
    expect(
      planSearchQueries({
        anchor: "empty",
        complete: "empty-only",
        includeShortNumbers: true,
        task: "Belajar fungsi kuadrat kelas 10 dan latihan SNBT 2026 set 2.",
        maxQueries: 4,
        queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
      })
    ).toEqual(["SNBT Pengetahuan Kuantitatif try out 2026 set 2"]);
  });

  it("completes only queries that already share a distinctive task term", () => {
    expect(
      planSearchQueries({
        anchor: "empty",
        complete: "matching",
        includeShortNumbers: true,
        task: "Aku mau belajar fungsi kuadrat kelas 10 dan latihan SNBT Pengetahuan Kuantitatif try out 2026 set 2.",
        maxQueries: 4,
        queries: [
          "fungsi kuadrat kelas 10",
          "   ",
          "SNBT Pengetahuan Kuantitatif",
        ],
      })
    ).toEqual([
      "fungsi kuadrat kelas 10",
      "2026 2 SNBT Pengetahuan Kuantitatif",
    ]);
  });

  it("extracts distinctive terms without language-specific keywords", () => {
    expect(
      getDistinctiveSearchTerms("AI SDK DevTools route-name 2026 set 2", {
        includeShortNumbers: true,
      })
    ).toEqual([
      { normalized: "ai", text: "AI" },
      { normalized: "sdk", text: "SDK" },
      { normalized: "devtools", text: "DevTools" },
      { normalized: "route name", text: "route-name" },
      { normalized: "2026", text: "2026" },
      { normalized: "2", text: "2" },
    ]);
    expect(
      getDistinctiveSearchTerms("ordinary words set 2", {
        includeShortNumbers: true,
      })
    ).toEqual([]);
    expect(getDistinctiveSearchTerms("SNBT SNBT")).toEqual([
      { normalized: "snbt", text: "SNBT" },
    ]);
    expect(getDistinctiveSearchTerms("SNBT 2")).toEqual([
      { normalized: "snbt", text: "SNBT" },
    ]);
  });

  it("checks searchable term groups and normalized term containment", () => {
    const snbtTerms = getDistinctiveSearchTerms("SNBT");
    const yearTerms = getDistinctiveSearchTerms("2026");
    const mixedCaseTerms = getDistinctiveSearchTerms("DevTools");
    const routeTerms = getDistinctiveSearchTerms("route-name");
    const shortAcronymTerms = getDistinctiveSearchTerms("AI");

    expect(hasSearchableTerms([])).toBe(false);
    expect(hasSearchableTerms(snbtTerms)).toBe(true);
    expect(hasSearchableTerms(yearTerms)).toBe(false);
    expect(hasSearchableTerms(mixedCaseTerms)).toBe(true);
    expect(hasSearchableTerms(routeTerms)).toBe(true);
    expect(hasSearchableTerms(shortAcronymTerms)).toBe(false);
    expect(hasSearchableTerms([...shortAcronymTerms, ...yearTerms])).toBe(true);
    expect(normalizeSearchTerm("AI-SDK, DevTools!")).toBe("ai sdk devtools");
    expect(
      normalizedSearchTextHasTerm("latest ai sdk devtools", mixedCaseTerms[0])
    ).toBe(true);
    expect(
      normalizedSearchTextHasTerm("latest ai sdk", mixedCaseTerms[0])
    ).toBe(false);
  });
});
