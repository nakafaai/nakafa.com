import { describe, expect, it } from "vitest";
import { createSEOTitle } from "../seo/titles";

describe("createSEOTitle", () => {
  describe("basic functionality", () => {
    it("creates title with single part and default site name", () => {
      const result = createSEOTitle(["Hello"]);
      expect(result).toBe("Hello - Nakafa");
    });

    it("creates title with multiple parts", () => {
      const result = createSEOTitle(["Part 1", "Part 2", "Part 3"]);
      expect(result).toBe("Part 1 - Part 2 - Part 3 - Nakafa");
    });

    it("uses custom site name", () => {
      const result = createSEOTitle(["Hello"], "Custom Site");
      expect(result).toBe("Hello - Custom Site");
    });

    it("returns only site name when no parts provided", () => {
      const result = createSEOTitle([]);
      expect(result).toBe("Nakafa");
    });

    it("returns only site name when all parts are null/undefined", () => {
      const result = createSEOTitle([null, undefined, null]);
      expect(result).toBe("Nakafa");
    });
  });

  describe("null and undefined filtering", () => {
    it("filters out null values", () => {
      const result = createSEOTitle(["First", null, "Second"]);
      expect(result).toBe("First - Second - Nakafa");
    });

    it("filters out undefined values", () => {
      const result = createSEOTitle(["First", undefined, "Second"]);
      expect(result).toBe("First - Second - Nakafa");
    });

    it("filters out empty strings", () => {
      const result = createSEOTitle(["First", "", "Second"]);
      expect(result).toBe("First - Second - Nakafa");
    });

    it("handles mixed null, undefined, and valid values", () => {
      const result = createSEOTitle([
        "First",
        null,
        undefined,
        "Second",
        "",
        "Third",
      ]);
      expect(result).toBe("First - Second - Third - Nakafa");
    });

    it("handles all falsy values", () => {
      const result = createSEOTitle([null, undefined, ""]);
      expect(result).toBe("Nakafa");
    });
  });

  describe("length truncation", () => {
    it("includes all parts when under max length", () => {
      const result = createSEOTitle(["Short", "Title"]);
      expect(result).toBe("Short - Title - Nakafa");
    });

    it("truncates when exceeding max length (55 chars + site name)", () => {
      const longPart = "A".repeat(30);
      const result = createSEOTitle([longPart, "Extra"]);
      // 30 chars + " - " + 5 chars + " - " + 6 chars = 44 chars, should fit
      expect(result).toBe(`${longPart} - Extra - Nakafa`);
    });

    it("stops adding parts when limit reached", () => {
      const part1 = "A".repeat(40);
      const part2 = "B".repeat(20);
      const result = createSEOTitle([part1, part2]);
      // 40 + " - " + 20 + " - " + 6 = 71 chars, exceeds 55 + 6 = 61
      // Should only include part1
      expect(result).toBe(`${part1} - Nakafa`);
    });

    it("includes parts that fit exactly at limit", () => {
      // 20 + " - " + 20 + " - " + 6 = 52 chars (under 55 + 6 = 61)
      const part1 = "A".repeat(20);
      const part2 = "B".repeat(20);
      const result = createSEOTitle([part1, part2]);
      expect(result).toBe(`${part1} - ${part2} - Nakafa`);
    });

    it("truncates first part smartly when it exceeds limit", () => {
      // MAX_LENGTH = 55, overhead = 9, so max first part = 46
      const veryLong = "This is a very long title that exceeds the limit";
      const result = createSEOTitle([veryLong]);
      // Should truncate at last space before 46 chars
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result).toContain("Nakafa");
      expect(result).not.toBe(`${veryLong} - Nakafa`);
    });

    it("truncates first part at word boundary", () => {
      // Create a string where word boundary exists before limit
      const longPart = `Short Word AnotherWord ${"X".repeat(50)}`;
      const result = createSEOTitle([longPart]);
      // Should truncate at last space, not mid-word
      expect(result.length).toBeLessThanOrEqual(55);
      // The truncated part should not end mid-word
      const truncatedPart = result.replace(" - Nakafa", "");
      expect(truncatedPart.endsWith("X")).toBe(false);
    });

    it("handles parts that would exactly hit the limit", () => {
      // 49 + " - " + 6 = 58 chars (over 55, should be truncated)
      const part = "A".repeat(49);
      const result = createSEOTitle([part]);
      // Should be truncated to fit within limit
      expect(result.length).toBeLessThanOrEqual(55);
    });
  });

  describe("priority ordering", () => {
    it("prioritizes earlier parts over later ones", () => {
      const parts = ["Important", "Less Important", "Least Important"];
      const result = createSEOTitle(parts);
      // All should fit: 9 + " - " + 14 + " - " + 16 + " - " + 6 = 53 chars
      expect(result).toBe(
        "Important - Less Important - Least Important - Nakafa"
      );
    });

    it("keeps high priority parts when truncating", () => {
      const highPriority = "Keep This";
      const mediumPriority = "B".repeat(30);
      const lowPriority = "C".repeat(30);
      const result = createSEOTitle([
        highPriority,
        mediumPriority,
        lowPriority,
      ]);
      // 9 + " - " + 30 + " - " + 6 = 50 chars, fits
      // Adding lowPriority would exceed limit
      expect(result).toBe(`${highPriority} - ${mediumPriority} - Nakafa`);
    });

    it("only includes first part if others would exceed limit", () => {
      const part1 = "First Part";
      const part2 = "X".repeat(50);
      const result = createSEOTitle([part1, part2]);
      // 10 + " - " + 50 + " - " + 6 = 71 chars, exceeds limit
      expect(result).toBe(`${part1} - Nakafa`);
    });
  });

  describe("real-world SEO scenarios", () => {
    it("handles subject page title", () => {
      const result = createSEOTitle([
        "Vertical Translation",
        "Function Transformation",
        "Summary",
        "Grade 12",
        "High School",
      ]);
      // Should intelligently truncate to fit within limit
      expect(result.length).toBeLessThanOrEqual(70); // Reasonable max
      expect(result).toContain("Vertical Translation");
      expect(result).toContain("Nakafa");
    });

    it("handles article page title", () => {
      const result = createSEOTitle(["Article Title", "Politics"]);
      expect(result).toBe("Article Title - Politics - Nakafa");
    });

    it("handles exercises page title", () => {
      const result = createSEOTitle([
        "Exercise 1",
        "Chapter 1",
        "Material",
        "Type",
        "High School",
      ]);
      expect(result.length).toBeLessThanOrEqual(70);
      expect(result).toContain("Exercise 1");
      expect(result).toContain("Nakafa");
    });

    it("handles very long content titles", () => {
      const longTitle =
        "This is a very long article title that might exceed the optimal length";
      const result = createSEOTitle([longTitle, "Category"]);
      // Long title should be truncated to fit within limit
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result).toContain("Nakafa");
      // Should contain start of the title (most important part)
      expect(result).toContain("This is a very long article");
    });

    it("handles missing metadata gracefully", () => {
      const result = createSEOTitle([null, "Fallback Category"]);
      expect(result).toBe("Fallback Category - Nakafa");
    });
  });

  describe("edge cases", () => {
    it("handles single character parts", () => {
      const result = createSEOTitle(["A", "B", "C"]);
      expect(result).toBe("A - B - C - Nakafa");
    });

    it("handles parts with special characters", () => {
      const result = createSEOTitle(["Hello!", "World@", "Test#"]);
      expect(result).toBe("Hello! - World@ - Test# - Nakafa");
    });

    it("handles parts with spaces", () => {
      const result = createSEOTitle(["Hello World", "Foo Bar"]);
      expect(result).toBe("Hello World - Foo Bar - Nakafa");
    });

    it("handles unicode characters", () => {
      const result = createSEOTitle(["你好", "世界"]);
      expect(result).toBe("你好 - 世界 - Nakafa");
    });

    it("handles emojis", () => {
      const result = createSEOTitle(["Hello 👋", "World 🌍"]);
      expect(result).toBe("Hello 👋 - World 🌍 - Nakafa");
    });

    it("handles empty string site name", () => {
      const result = createSEOTitle(["Hello"], "");
      expect(result).toBe("Hello - ");
    });

    it("handles very long site name", () => {
      const longSiteName = "A".repeat(50);
      const result = createSEOTitle(["Hello"], longSiteName);
      // With long site name, first part may be truncated to fit limit
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result).toContain(longSiteName);
    });

    it("truncates site name when it exceeds MAX_LENGTH (Devin AI bug fix)", () => {
      // Edge case: siteName itself is longer than MAX_LENGTH (55)
      const veryLongSiteName =
        "Very Long Site Name That Exceeds The Maximum Length";
      const result = createSEOTitle(["Hello"], veryLongSiteName);
      // Result should never exceed MAX_LENGTH
      expect(result.length).toBeLessThanOrEqual(55);
      // Should contain truncated site name
      expect(result).toContain("Very Long Site Name");
    });

    it("returns truncated site name only when siteName exceeds MAX_LENGTH and no parts", () => {
      const veryLongSiteName =
        "ThisIsAVeryLongSiteNameThatExceedsTheMaximumLengthOfFiftyFive";
      const result = createSEOTitle([], veryLongSiteName);
      // Should return truncated site name
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result.endsWith("...")).toBe(false); // Clean cut, no ellipsis
    });

    it("handles site name exactly at MAX_LENGTH", () => {
      const exactLengthSiteName = "A".repeat(55);
      const result = createSEOTitle(["Hello"], exactLengthSiteName);
      // Should truncate site name to make room for parts
      expect(result.length).toBeLessThanOrEqual(55);
    });

    it("enforces MAX_LENGTH even with extremely long site name", () => {
      // Site name of 100 characters
      const extremelyLongSiteName = "A".repeat(100);
      const result = createSEOTitle(["Short"], extremelyLongSiteName);
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
      const result = createSEOTitle([], siteNameWithSpaces);
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
      const result = createSEOTitle([], siteNameNoSpaces);
      // Should be truncated at exactly MAX_LENGTH (no spaces to find)
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result).toBe("A".repeat(55));
    });

    it("filters out whitespace-only strings", () => {
      const result = createSEOTitle(["Hello", "   ", "World"]);
      // Whitespace-only strings should be filtered out to prevent malformed titles
      expect(result).toBe("Hello - World - Nakafa");
    });

    it("trims leading and trailing whitespace from parts", () => {
      const result = createSEOTitle(["  Hello  ", "  World  "]);
      // Parts should be trimmed to prevent extra spaces in title
      expect(result).toBe("Hello - World - Nakafa");
    });

    it("handles zero as a part", () => {
      const result = createSEOTitle(["Hello", 0 as unknown as string, "World"]);
      // 0 is falsy, should be filtered out
      expect(result).toBe("Hello - World - Nakafa");
    });

    it("handles false as a part", () => {
      const result = createSEOTitle([
        "Hello",
        false as unknown as string,
        "World",
      ]);
      // false is falsy, should be filtered out
      expect(result).toBe("Hello - World - Nakafa");
    });
  });

  describe("separator handling", () => {
    it("uses correct separator between parts", () => {
      const result = createSEOTitle(["A", "B", "C"]);
      expect(result).toBe("A - B - C - Nakafa");
    });

    it("does not add separator after last part before site name", () => {
      const result = createSEOTitle(["Only"]);
      expect(result).toBe("Only - Nakafa");
    });

    it("calculates separator length correctly in limit check", () => {
      // 10 + " - " + 10 + " - " + 6 = 32 chars
      const part1 = "A".repeat(10);
      const part2 = "B".repeat(10);
      const result = createSEOTitle([part1, part2]);
      expect(result).toBe(`${part1} - ${part2} - Nakafa`);
    });
  });

  describe("type safety", () => {
    it("accepts readonly arrays", () => {
      const parts: readonly string[] = ["One", "Two"];
      const result = createSEOTitle(parts as string[]);
      expect(result).toBe("One - Two - Nakafa");
    });

    it("handles mixed types in array", () => {
      const parts: (string | null | undefined)[] = [
        "Valid",
        null,
        undefined,
        "Also Valid",
      ];
      const result = createSEOTitle(parts);
      expect(result).toBe("Valid - Also Valid - Nakafa");
    });
  });
});
