// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { createSEOTitle } from "@/lib/seo/titles";

describe("createSEOTitle", () => {
  describe("basic functionality", () => {
    it("creates title with single part and default site name", () => {
      const result = createSEOTitle(["Hello"], "home");
      expect(result).toBe("Hello - Nakafa");
    });

    it("creates title with multiple parts", () => {
      const result = createSEOTitle(["Part 1", "Part 2", "Part 3"], "home");
      expect(result).toBe("Part 1 - Part 2 - Part 3 - Nakafa");
    });

    it("uses custom site name", () => {
      const result = createSEOTitle(["Hello"], "home", "Custom Site");
      expect(result).toBe("Hello - Custom Site");
    });

    it("returns only site name when no parts provided", () => {
      const result = createSEOTitle([], "home");
      expect(result).toBe("Nakafa");
    });

    it("returns only site name when every part is missing", () => {
      const result = createSEOTitle([undefined, undefined], "home");
      expect(result).toBe("Nakafa");
    });
  });

  describe("missing and empty parts", () => {
    it("filters out undefined values", () => {
      const result = createSEOTitle(["First", undefined, "Second"], "home");
      expect(result).toBe("First - Second - Nakafa");
    });

    it("filters out empty strings", () => {
      const result = createSEOTitle(["First", "", "Second"], "home");
      expect(result).toBe("First - Second - Nakafa");
    });

    it("handles missing, empty, and valid values together", () => {
      const result = createSEOTitle(
        ["First", undefined, "Second", "", "Third"],
        "home"
      );
      expect(result).toBe("First - Second - Third - Nakafa");
    });

    it("returns only site name when every part is missing or empty", () => {
      const result = createSEOTitle([undefined, "", "   "], "home");
      expect(result).toBe("Nakafa");
    });
  });

  describe("length truncation", () => {
    it("includes all parts when under max length", () => {
      const result = createSEOTitle(["Short", "Title"], "home");
      expect(result).toBe("Short - Title - Nakafa");
    });

    it("truncates when exceeding max length (55 chars + site name)", () => {
      const longPart = "A".repeat(30);
      const result = createSEOTitle([longPart, "Extra"], "home");
      // 30 chars + " - " + 5 chars + " - " + 6 chars = 44 chars, should fit
      expect(result).toBe(`${longPart} - Extra - Nakafa`);
    });

    it("stops adding parts when limit reached", () => {
      const part1 = "A".repeat(40);
      const part2 = "B".repeat(20);
      const result = createSEOTitle([part1, part2], "home");
      // 40 + " - " + 20 + " - " + 6 = 71 chars, exceeds 55 + 6 = 61
      // Should only include part1
      expect(result).toBe(`${part1} - Nakafa`);
    });

    it("includes parts that fit exactly at limit", () => {
      // 20 + " - " + 20 + " - " + 6 = 52 chars (under 55 + 6 = 61)
      const part1 = "A".repeat(20);
      const part2 = "B".repeat(20);
      const result = createSEOTitle([part1, part2], "home");
      expect(result).toBe(`${part1} - ${part2} - Nakafa`);
    });

    it("keeps a first part whole, alone, when it leaves no room for the site name", () => {
      const analytical =
        "Vector Addition and Subtraction with Analytical Method";
      const graphical = "Vector Addition and Subtraction with Graphical Method";

      expect(createSEOTitle([analytical, "Vector"], "home")).toBe(analytical);
      expect(createSEOTitle([graphical, "Vector"], "home")).toBe(graphical);
    });
  });

  describe("priority ordering", () => {
    it("prioritizes earlier parts over later ones", () => {
      const parts = ["Important", "Less Important", "Least Important"];
      const result = createSEOTitle(parts, "home");
      // All should fit: 9 + " - " + 14 + " - " + 16 + " - " + 6 = 53 chars
      expect(result).toBe(
        "Important - Less Important - Least Important - Nakafa"
      );
    });

    it("keeps high priority parts when truncating", () => {
      const highPriority = "Keep This";
      const mediumPriority = "B".repeat(30);
      const lowPriority = "C".repeat(30);
      const result = createSEOTitle(
        [highPriority, mediumPriority, lowPriority],
        "home"
      );
      // 9 + " - " + 30 + " - " + 6 = 50 chars, fits
      // Adding lowPriority would exceed limit
      expect(result).toBe(`${highPriority} - ${mediumPriority} - Nakafa`);
    });

    it("only includes first part if others would exceed limit", () => {
      const part1 = "First Part";
      const part2 = "X".repeat(50);
      const result = createSEOTitle([part1, part2], "home");
      // 10 + " - " + 50 + " - " + 6 = 71 chars, exceeds limit
      expect(result).toBe(`${part1} - Nakafa`);
    });
  });

  describe("real-world SEO scenarios", () => {
    it("handles curriculum page title", () => {
      const result = createSEOTitle(
        [
          "Vertical Translation",
          "Function Transformation",
          "Summary",
          "Grade 12",
          "High School",
        ],
        "home"
      );
      // Should intelligently truncate to fit within limit
      expect(result.length).toBeLessThanOrEqual(70); // Reasonable max
      expect(result).toContain("Vertical Translation");
      expect(result).toContain("Nakafa");
    });

    it("handles article page title", () => {
      const result = createSEOTitle(["Article Title", "Politics"], "home");
      expect(result).toBe("Article Title - Politics - Nakafa");
    });

    it("handles exercises page title", () => {
      const result = createSEOTitle(
        ["Exercise 1", "Chapter 1", "Material", "Type", "High School"],
        "home"
      );
      expect(result.length).toBeLessThanOrEqual(70);
      expect(result).toContain("Exercise 1");
      expect(result).toContain("Nakafa");
    });

    it("handles very long content titles", () => {
      const longTitle =
        "This is a very long article title that might exceed the optimal length";
      const result = createSEOTitle([longTitle, "Category"], "home");
      // A search result shortens it by itself, and the page keeps its whole name.
      expect(result).toBe(longTitle);
    });

    it("handles missing metadata gracefully", () => {
      const result = createSEOTitle([undefined, "Fallback Category"], "home");
      expect(result).toBe("Fallback Category - Nakafa");
    });
  });

  describe("edge cases", () => {
    it("handles single character parts", () => {
      const result = createSEOTitle(["A", "B", "C"], "home");
      expect(result).toBe("A - B - C - Nakafa");
    });

    it("handles parts with special characters", () => {
      const result = createSEOTitle(["Hello!", "World@", "Test#"], "home");
      expect(result).toBe("Hello! - World@ - Test# - Nakafa");
    });

    it("handles parts with spaces", () => {
      const result = createSEOTitle(["Hello World", "Foo Bar"], "home");
      expect(result).toBe("Hello World - Foo Bar - Nakafa");
    });

    it("handles unicode characters", () => {
      const result = createSEOTitle(["你好", "世界"], "home");
      expect(result).toBe("你好 - 世界 - Nakafa");
    });

    it("handles emojis", () => {
      const result = createSEOTitle(["Hello 👋", "World 🌍"], "home");
      expect(result).toBe("Hello 👋 - World 🌍 - Nakafa");
    });

    it("handles empty string site name", () => {
      const result = createSEOTitle(["Hello"], "home", "");
      expect(result).toBe("Hello - ");
    });

    it("handles very long site name", () => {
      const longSiteName = "A".repeat(50);
      const result = createSEOTitle(["Hello"], "home", longSiteName);
      // The part stays whole, so it stands without a site name that leaves it no room.
      expect(result).toBe("Hello");
    });

    it("truncates site name when it exceeds MAX_LENGTH (Devin AI bug fix)", () => {
      // Edge case: siteName itself is longer than MAX_LENGTH (55)
      const veryLongSiteName =
        "Very Long Site Name That Exceeds The Maximum Length";
      const result = createSEOTitle(["Hello"], "home", veryLongSiteName);
      // Such a name leaves the part no room, so the part stands without it.
      expect(result).toBe("Hello");
    });

    it("returns truncated site name only when siteName exceeds MAX_LENGTH and no parts", () => {
      const veryLongSiteName =
        "ThisIsAVeryLongSiteNameThatExceedsTheMaximumLengthOfFiftyFive";
      const result = createSEOTitle([], "home", veryLongSiteName);
      // Should return truncated site name
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result.endsWith("...")).toBe(false); // Clean cut, no ellipsis
    });

    it("handles site name exactly at MAX_LENGTH", () => {
      const exactLengthSiteName = "A".repeat(55);
      const result = createSEOTitle(["Hello"], "home", exactLengthSiteName);
      // Should truncate site name to make room for parts
      expect(result.length).toBeLessThanOrEqual(55);
    });

    it("enforces MAX_LENGTH even with extremely long site name", () => {
      // Site name of 100 characters
      const extremelyLongSiteName = "A".repeat(100);
      const result = createSEOTitle(["Short"], "home", extremelyLongSiteName);
      // Must never exceed MAX_LENGTH
      expect(result.length).toBeLessThanOrEqual(55);
      // Should be truncated
      expect(result).not.toBe(extremelyLongSiteName);
    });

    it("truncates site name at word boundary when possible", () => {
      // Site name with spaces - should truncate at word boundary
      // "Very Long Site Name That Exceeds The Maximum Length Of Fifty Five" is 66 chars
      // Truncated to 55: "Very Long Site Name That Exceeds The Maximum Length Of" (54 chars)
      const siteNameWithSpaces =
        "Very Long Site Name That Exceeds The Maximum Length Of Fifty Five";
      const result = createSEOTitle([], "home", siteNameWithSpaces);
      // Should be truncated at word boundary (not mid-word)
      expect(result.length).toBeLessThanOrEqual(55);
      // Should end at a word boundary (not mid-word)
      expect(result).not.toContain("Fifty");
      // Should contain the beginning
      expect(result).toContain("Very Long Site Name");
    });

    it("truncates site name at MAX_LENGTH when no spaces found", () => {
      // Site name without spaces - should truncate at MAX_LENGTH
      const siteNameNoSpaces = "A".repeat(100);
      const result = createSEOTitle([], "home", siteNameNoSpaces);
      // Should be truncated at exactly MAX_LENGTH (no spaces to find)
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result).toBe("A".repeat(55));
    });

    it("filters out whitespace-only strings", () => {
      const result = createSEOTitle(["Hello", "   ", "World"], "home");
      // Whitespace-only strings should be filtered out to prevent malformed titles
      expect(result).toBe("Hello - World - Nakafa");
    });

    it("trims leading and trailing whitespace from parts", () => {
      const result = createSEOTitle(["  Hello  ", "  World  "], "home");
      // Parts should be trimmed to prevent extra spaces in title
      expect(result).toBe("Hello - World - Nakafa");
    });
  });

  describe("separator handling", () => {
    it("uses correct separator between parts", () => {
      const result = createSEOTitle(["A", "B", "C"], "home");
      expect(result).toBe("A - B - C - Nakafa");
    });

    it("does not add separator after last part before site name", () => {
      const result = createSEOTitle(["Only"], "home");
      expect(result).toBe("Only - Nakafa");
    });

    it("calculates separator length correctly in limit check", () => {
      // 10 + " - " + 10 + " - " + 6 = 32 chars
      const part1 = "A".repeat(10);
      const part2 = "B".repeat(10);
      const result = createSEOTitle([part1, part2], "home");
      expect(result).toBe(`${part1} - ${part2} - Nakafa`);
    });
  });

  describe("type safety", () => {
    it("accepts readonly arrays", () => {
      const parts: readonly string[] = ["One", "Two"];
      const result = createSEOTitle(parts, "home");
      expect(result).toBe("One - Two - Nakafa");
    });
  });

  describe("the pages a learner finds by searching", () => {
    it("gives a lesson, an article, a try-out page, a curriculum page and a surah the whole budget, without the site name", () => {
      for (const kind of [
        "lesson",
        "article",
        "tryout",
        "curriculum",
        "quran",
      ] as const) {
        expect(createSEOTitle(["Elips", "Matematika Kelas 12"], kind)).toBe(
          "Elips - Matematika Kelas 12"
        );
      }
    });

    it("fits more parts once the site name leaves the budget", () => {
      const parts = ["Elips", "Matematika Kelas 12", "Geometri Analitik"];
      expect(createSEOTitle(parts, "lesson")).toBe(
        "Elips - Matematika Kelas 12 - Geometri Analitik"
      );
      expect(createSEOTitle(parts, "home")).toBe(
        "Elips - Matematika Kelas 12 - Nakafa"
      );
    });

    it("stops at the first part past the 55-character budget, and keeps a long first part whole", () => {
      const name = "A".repeat(40);
      expect(createSEOTitle([name, "B".repeat(12)], "lesson")).toBe(
        `${name} - ${"B".repeat(12)}`
      );
      expect(createSEOTitle([name, "B".repeat(13)], "lesson")).toBe(name);
      expect(createSEOTitle(["C".repeat(70), "Topic"], "article")).toBe(
        "C".repeat(70)
      );
    });

    it("falls back to the site name when the page has no title of its own", () => {
      expect(createSEOTitle([undefined, " "], "quran")).toBe("Nakafa");
    });

    it("keeps the site name on the home, a hub, and the marketing, legal and account pages", () => {
      for (const kind of [
        "home",
        "hub",
        "marketing",
        "legal",
        "account",
      ] as const) {
        expect(createSEOTitle(["Artikel"], kind)).toBe("Artikel - Nakafa");
      }
    });
  });
});
