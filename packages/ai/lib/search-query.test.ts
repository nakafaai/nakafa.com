import {
  getDistinctiveSearchTerms,
  hasSearchableTerms,
  normalizedSearchTextHasTerm,
  normalizeSearchTerm,
  planSearchQueries,
} from "@repo/ai/lib/search-query";
import { describe, expect, it } from "vitest";

describe("search query planning", () => {
  it("keeps generated queries as executable search text", () => {
    expect(
      planSearchQueries({
        task: "Aku mau latihan SNBT Pengetahuan Kuantitatif try out 2026 set 2.",
        maxQueries: 4,
        queries: ["Pengetahuan Kuantitatif SNBT"],
      })
    ).toEqual(["Pengetahuan Kuantitatif SNBT"]);
  });

  it("uses a concise task fallback for empty query lists", () => {
    expect(
      planSearchQueries({
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
        task: "2026",
        maxQueries: 4,
        queries: [],
      })
    ).toEqual([]);
  });

  it("does not add clipped research task anchors when queries exist", () => {
    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026.",
        maxQueries: 2,
        queries: [
          '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
          '"SMA Tirta Lazuardi" kegiatan 2026',
        ],
      })
    ).toEqual([
      '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
      '"SMA Tirta Lazuardi" kegiatan 2026',
    ]);
  });

  it("keeps lower-case feature queries unchanged", () => {
    expect(
      planSearchQueries({
        task: "apa yang berubah di next.js 16 cache components buat upgrade?",
        maxQueries: 2,
        queries: ["next.js 16 cache components upgrade"],
      })
    ).toEqual(["next.js 16 cache components upgrade"]);
  });

  it("does not execute internal markdown section labels as fallback terms", () => {
    expect(
      planSearchQueries({
        task: [
          "# User Request",
          "Untuk migrasi Next.js 16, Cache Components berubah apa menurut pihak pembuat Next.js sendiri?",
          "# Task",
          "Find official Next.js 16 Cache Components changes.",
        ].join("\n\n"),
        maxQueries: 2,
        queries: [],
      })
    ).toEqual(["Next.js 16"]);
  });

  it("falls back to heading text only when a task has no body content", () => {
    expect(
      planSearchQueries({
        task: "# SNBT",
        maxQueries: 2,
        queries: [],
      })
    ).toEqual(["SNBT"]);
  });

  it("can disable executable task anchors while still completing query text", () => {
    expect(
      planSearchQueries({
        fallback: "none",
        task: "AI SDK DevTools 2026",
        maxQueries: 4,
        queries: ["AI SDK DevTools", "  ", "ai sdk devtools"],
      })
    ).toEqual(["AI SDK DevTools"]);
  });

  it("keeps existing queries isolated from global task terms", () => {
    expect(
      planSearchQueries({
        includeShortNumbers: true,
        task: "Belajar fungsi kuadrat kelas 10 dan latihan SNBT 2026 set 2.",
        maxQueries: 4,
        queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
      })
    ).toEqual(["SNBT Pengetahuan Kuantitatif try out 2026 set 2"]);
  });

  it("deduplicates and limits normalized executable queries", () => {
    expect(
      planSearchQueries({
        task: "Aku mau belajar fungsi kuadrat kelas 10 dan latihan SNBT Pengetahuan Kuantitatif try out 2026 set 2.",
        maxQueries: 2,
        queries: [
          "fungsi   kuadrat kelas 10",
          "   ",
          "fungsi kuadrat kelas 10",
          "SNBT Pengetahuan Kuantitatif",
        ],
      })
    ).toEqual(["fungsi kuadrat kelas 10", "SNBT Pengetahuan Kuantitatif"]);
  });

  it("drops unscoped query variants when scoped named-entity queries exist", () => {
    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026.",
        maxQueries: 4,
        queries: [
          '"SMA Tirta Lazuardi"',
          '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
          '"tryout matematika nasional" 28 Mei 2026',
        ],
        scopeByNamedPhrases: true,
      })
    ).toEqual([
      '"SMA Tirta Lazuardi"',
      '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
    ]);
  });

  it("preserves dropped date context on the strongest scoped query", () => {
    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026.",
        maxQueries: 4,
        queries: [
          '"SMA Tirta Lazuardi"',
          '"tryout matematika nasional" 28 Mei 2026',
          '"SMA Tirta Lazuardi" tryout matematika nasional',
        ],
        scopeByNamedPhrases: true,
      })
    ).toEqual([
      '"SMA Tirta Lazuardi"',
      '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
    ]);
  });

  it("deduplicates repeated dropped date context before appending it", () => {
    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026.",
        maxQueries: 4,
        queries: [
          '"SMA Tirta Lazuardi" tryout matematika nasional',
          '"tryout matematika nasional" 28 Mei 2026',
          "28 2026 tryout nasional",
        ],
        scopeByNamedPhrases: true,
      })
    ).toEqual(['"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026']);
  });

  it("preserves title-case date context that appears before a number", () => {
    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout pada Mei 2026.",
        maxQueries: 4,
        queries: ['"SMA Tirta Lazuardi" tryout', '"tryout nasional" Mei 2026'],
        scopeByNamedPhrases: true,
      })
    ).toEqual(['"SMA Tirta Lazuardi" tryout Mei 2026']);
  });

  it("ignores title-case dropped context without adjacent numbers", () => {
    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout.",
        maxQueries: 4,
        queries: [
          '"SMA Tirta Lazuardi" tryout',
          "Kabar tryout",
          "tryout Kabar",
        ],
        scopeByNamedPhrases: true,
      })
    ).toEqual(['"SMA Tirta Lazuardi" tryout']);
  });

  it("keeps generated queries when no query preserves a named task phrase", () => {
    expect(
      planSearchQueries({
        task: "Bandingkan Next.js Cache Components dengan route cache lama.",
        maxQueries: 4,
        queries: ["route cache migration", "cache components behavior"],
      })
    ).toEqual(["route cache migration", "cache components behavior"]);
  });

  it("ignores weak and duplicate named phrase runs while scoping variants", () => {
    expect(
      planSearchQueries({
        task: "Budi Santoso bertanya tentang SMA Tirta Lazuardi dan SMA Tirta Lazuardi.",
        maxQueries: 4,
        queries: ['"SMA Tirta Lazuardi" profil', "pertanyaan umum"],
        scopeByNamedPhrases: true,
      })
    ).toEqual(['"SMA Tirta Lazuardi" profil']);
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
