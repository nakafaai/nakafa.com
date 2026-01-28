import { describe, expect, it } from "vitest";
import { createSEODescription } from "../seo/descriptions";

describe("createSEODescription", () => {
  describe("basic functionality", () => {
    it("returns first valid part when it meets minLength", () => {
      const longDescription =
        "Primary description that is long enough to meet the minimum length requirement of one hundred twenty characters or more.";
      const result = createSEODescription([
        longDescription,
        "Fallback description",
      ]);
      expect(result).toBe(longDescription);
    });

    it("combines parts to reach minLength when first part is too short", () => {
      const result = createSEODescription(
        ["Short", "Additional context to extend the description"],
        { minLength: 30, maxLength: 100 }
      );
      expect(result).toContain("Short");
      expect(result).toContain("Additional");
      expect(result.length).toBeGreaterThanOrEqual(30);
    });

    it("skips null and undefined values", () => {
      const result = createSEODescription([
        null,
        undefined,
        "Valid description",
      ]);
      expect(result).toBe("Valid description");
    });

    it("skips empty strings", () => {
      const result = createSEODescription(["", "   ", "Valid description"]);
      expect(result).toBe("Valid description");
    });

    it("returns empty string when no valid parts", () => {
      const result = createSEODescription([null, undefined, ""]);
      expect(result).toBe("");
    });

    it("trims whitespace from parts", () => {
      const result = createSEODescription(["  Description with spaces  "]);
      expect(result).toBe("Description with spaces");
    });
  });

  describe("length handling", () => {
    it("returns description under max length as-is", () => {
      const description = "This is a normal description.";
      const result = createSEODescription([description]);
      expect(result).toBe(description);
      expect(result.length).toBeLessThanOrEqual(160);
    });

    it("truncates at sentence boundary when over max length", () => {
      const longDescription =
        "First sentence here. Second sentence that makes it too long with many words and characters. Third sentence should not appear.";
      const result = createSEODescription([longDescription], {
        maxLength: 50,
      });
      expect(result).toBe("First sentence here.");
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it("truncates at word boundary when no sentence boundary", () => {
      const longWord =
        "ThisIsAVeryLongWordWithoutAnySentenceBreaksOrSpacesThatNeedsToBeTruncated";
      const result = createSEODescription([longWord], { maxLength: 30 });
      expect(result.length).toBeLessThanOrEqual(30);
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
    });

    it("handles description at exact max length", () => {
      const exactLength = "A".repeat(160);
      const result = createSEODescription([exactLength]);
      expect(result).toBe(exactLength);
    });

    it("handles description slightly over max length", () => {
      const slightlyOver = "A".repeat(165);
      const result = createSEODescription([slightlyOver]);
      expect(result.length).toBeLessThanOrEqual(160);
    });
  });

  describe("sentence boundary truncation", () => {
    it("truncates at period", () => {
      const text =
        "First sentence. Second sentence that is way too long and should be truncated.";
      const result = createSEODescription([text], { maxLength: 40 });
      expect(result).toBe("First sentence.");
    });

    it("truncates at exclamation mark", () => {
      const text =
        "Exciting news! This is a very long description that exceeds the limit.";
      const result = createSEODescription([text], { maxLength: 30 });
      expect(result).toBe("Exciting news!");
    });

    it("truncates at question mark", () => {
      const text =
        "What is this? A very long description that goes on and on without stopping.";
      const result = createSEODescription([text], { maxLength: 25 });
      expect(result).toBe("What is this?");
    });

    it("prefers longer sentence over word truncation", () => {
      const text =
        "Short. This is a much longer sentence that provides more context and value for SEO purposes.";
      const result = createSEODescription([text], { maxLength: 80 });
      // Should include the longer second sentence if it fits
      expect(result).toContain("This is a much longer sentence");
    });
  });

  describe("word boundary truncation", () => {
    it("truncates at last space before limit", () => {
      const text =
        "Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10";
      const result = createSEODescription([text], {
        maxLength: 30,
        minLength: 10,
      });
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it("does not cut words in half", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const result = createSEODescription([text], { maxLength: 25 });
      const words = result.trim().split(" ");
      // All words should be complete (no partial words)
      for (const word of words) {
        expect(word).not.toBe("");
        expect(word.length).toBeGreaterThan(0);
      }
    });
  });

  describe("fallback chain", () => {
    it("uses first valid part from chain when it meets minLength", () => {
      const longPart =
        "First valid part that is definitely long enough to meet the minimum length requirement of one hundred twenty characters or more.";
      const result = createSEODescription([
        null,
        undefined,
        "",
        longPart,
        "Second valid",
      ]);
      expect(result).toBe(longPart);
    });

    it("handles all nulls then valid", () => {
      const result = createSEODescription([null, null, null, "Finally valid"]);
      expect(result).toBe("Finally valid");
    });

    it("combines multiple valid parts to reach minLength", () => {
      const result = createSEODescription(
        ["Short", "Additional context to extend"],
        { minLength: 30, maxLength: 100 }
      );
      expect(result).toContain("Short");
      expect(result).toContain("Additional");
      expect(result.length).toBeGreaterThanOrEqual(30);
    });

    it("uses single part when it already meets minLength", () => {
      const longDescription =
        "This is a comprehensive description that easily meets the minimum length requirement of one hundred twenty characters or more.";
      const result = createSEODescription([
        "",
        longDescription,
        "Also valid but not needed",
      ]);
      expect(result).toBe(longDescription);
    });
  });

  describe("real-world SEO scenarios", () => {
    it("handles typical content description", () => {
      const result = createSEODescription([
        "Learn about vertical translation in function transformation. This concept is fundamental to understanding graph movements.",
      ]);
      expect(result.length).toBeGreaterThanOrEqual(120);
      expect(result.length).toBeLessThanOrEqual(160);
    });

    it("handles quran surah description", () => {
      const result = createSEODescription([
        "The Opening (Al-Fatihah) - 7 verses - Read the Quran with translation and interpretation on Nakafa",
      ]);
      expect(result).toContain("Al-Fatihah");
      expect(result).toContain("7 verses");
    });

    it("handles exercise description", () => {
      const result = createSEODescription([
        "Practice exercises on vertical translation. Master the concept with interactive problems and detailed solutions.",
      ]);
      expect(result).toContain("Practice exercises");
    });

    it("uses fallback when primary is missing", () => {
      const result = createSEODescription([
        null,
        "Vertical Translation. Learn with Nakafa",
      ]);
      expect(result).toBe("Vertical Translation. Learn with Nakafa");
    });
  });

  describe("custom length options", () => {
    it("respects custom maxLength", () => {
      const longText = "A".repeat(200);
      const result = createSEODescription([longText], { maxLength: 100 });
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it("respects custom minLength for sentence truncation", () => {
      const text =
        "Short. This is a longer sentence that should be included if minLength allows.";
      const result = createSEODescription([text], {
        maxLength: 80,
        minLength: 20,
      });
      expect(result.length).toBeGreaterThanOrEqual(20);
    });

    it("combines fallbacks to reach minLength", () => {
      const result = createSEODescription(
        ["Short title", "Additional context that extends the description"],
        { minLength: 30, maxLength: 100 }
      );
      expect(result.length).toBeGreaterThanOrEqual(30);
      expect(result).toContain("Short title");
      expect(result).toContain("Additional context");
    });

    it("uses multiple fallbacks if needed", () => {
      const result = createSEODescription(
        ["A", "B", "C", "D is a longer piece of text"],
        { minLength: 10, maxLength: 50 }
      );
      expect(result.length).toBeGreaterThanOrEqual(10);
    });

    it("stops adding fallbacks when maxLength reached", () => {
      const result = createSEODescription(
        ["First part", "Second part", "Third part that is very long"],
        { minLength: 20, maxLength: 35 }
      );
      expect(result.length).toBeLessThanOrEqual(35);
      expect(result.length).toBeGreaterThanOrEqual(20);
    });

    it("handles case where no combination can reach minLength", () => {
      const result = createSEODescription(["A", "B", "C"], {
        minLength: 100,
        maxLength: 160,
      });
      // Should return what we have even if under minLength
      expect(result.length).toBeGreaterThan(0);
    });

    it("adds partial fallback when combined exceeds maxLength", () => {
      const result = createSEODescription(
        [
          "Short title here",
          "Additional context that extends the description significantly",
        ],
        { minLength: 20, maxLength: 50 }
      );
      // Should include partial fallback with clean word boundary (no ellipsis)
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toContain("Short title here");
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
    });

    it("skips partial fallback when remaining space is too small", () => {
      // Create a scenario where:
      // - First part is 56 chars (under minLength of 60, so we try to add more)
      // - Second part is "Tiny" (4 chars)
      // - Combined would be 56 + 1 + 4 = 61 > 60 (maxLength), so we enter else branch
      // - remainingSpace = 60 - 56 - 1 = 3 <= 10, so we skip partial fallback
      const result = createSEODescription(
        ["This is a very long first part that takes most of the sp", "Tiny"],
        { minLength: 60, maxLength: 60 }
      );
      // Should not add partial fallback if remaining space <= 10
      expect(result.length).toBeLessThanOrEqual(60);
      // Should just be the first part without any addition
      expect(result).toBe(
        "This is a very long first part that takes most of the sp"
      );
    });

    it("handles partial fallback with word boundary", () => {
      const result = createSEODescription(
        ["First part here", "Second part with multiple words"],
        { minLength: 20, maxLength: 40 }
      );
      // Should end at word boundary with clean cut (no ellipsis)
      expect(result.length).toBeLessThanOrEqual(40);
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
      // Should contain first part
      expect(result).toContain("First part here");
    });

    it("skips partial fallback when no good word boundary found", () => {
      // Create a scenario where remaining space > 10 but lastSpace <= 5
      // This happens when the next part starts with a very long word
      const result = createSEODescription(
        [
          "Short title here",
          "Supercalifragilisticexpialidocious is a very long word",
        ],
        { minLength: 20, maxLength: 45 }
      );
      // Should not add partial fallback if no good word boundary
      expect(result.length).toBeLessThanOrEqual(45);
      // Should just be the first part
      expect(result).toBe("Short title here");
    });

    it("never exceeds maxLength when adding partial fallback", () => {
      // This test verifies the bug fix: partial fallback must not exceed maxLength
      // First part is 27 chars (under minLength 35), so it will try to add fallback
      // Combined would be 27 + 1 + 50 = 78 > 60 (maxLength), so partial fallback is used
      const result = createSEODescription(
        [
          "Short title that needs more",
          "Additional context that extends the description significantly for testing",
        ],
        { minLength: 35, maxLength: 60 }
      );
      // Must never exceed maxLength
      expect(result.length).toBeLessThanOrEqual(60);
      // Should contain the first part
      expect(result).toContain("Short title that needs more");
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
    });

    it("handles edge case where remaining space is limited", () => {
      // Test the boundary where remainingSpace is tight
      const result = createSEODescription(
        [
          "This is fifty chars exactly for test purposes",
          "Additional content here",
        ],
        { minLength: 60, maxLength: 70 }
      );
      // Should handle the boundary correctly
      expect(result.length).toBeLessThanOrEqual(70);
      expect(result).toContain("This is fifty chars exactly for test purposes");
    });

    it("accounts for all characters in partial fallback", () => {
      // Create a precise test case to verify the math
      // First part: 26 chars, maxLength: 50
      // remainingSpace = 50 - 26 - 1 = 23 chars available for partial
      // With word boundary, we might get less, but total must be <= 50
      const result = createSEODescription(
        [
          "Twenty six character text",
          "Additional words to extend this description significantly",
        ],
        { minLength: 35, maxLength: 50 }
      );
      // Verify strict maxLength compliance
      expect(result.length).toBeLessThanOrEqual(50);
      // Verify structure: first part + space + partial
      expect(result.startsWith("Twenty six character text")).toBe(true);
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles single character", () => {
      const result = createSEODescription(["X"]);
      expect(result).toBe("X");
    });

    it("handles only whitespace", () => {
      const result = createSEODescription(["   ", "\t\n"]);
      expect(result).toBe("");
    });

    it("handles special characters", () => {
      const result = createSEODescription([
        "Description with émojis 🎉 and spëciål chars!",
      ]);
      expect(result).toContain("émojis");
    });

    it("handles very long single word", () => {
      const longWord = "a".repeat(200);
      const result = createSEODescription([longWord]);
      expect(result.length).toBeLessThanOrEqual(160);
      // Clean cut - no ellipsis
      expect(result.endsWith("...")).toBe(false);
    });

    it("handles multiple sentences at boundary", () => {
      const text =
        "First. Second. Third. Fourth. Fifth. Sixth. Seventh. Eighth. Ninth. Tenth.";
      const result = createSEODescription([text], { maxLength: 50 });
      // Should end with a complete sentence
      expect(
        result.endsWith(".") || result.endsWith("!") || result.endsWith("?")
      ).toBe(true);
    });
  });

  describe("SEO compliance", () => {
    it("produces descriptions within SEO range", () => {
      const descriptions = [
        "Short.",
        "Medium length description here.",
        "A".repeat(150),
        "A".repeat(200),
        "First. Second. Third. Fourth. Fifth.",
      ];

      for (const desc of descriptions) {
        const result = createSEODescription([desc]);
        // All results should be reasonable for SEO
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(160);
      }
    });

    it("never returns undefined or null", () => {
      const result = createSEODescription([]);
      expect(result).toBe("");
      expect(typeof result).toBe("string");
    });

    it("preserves important keywords in truncation", () => {
      const text =
        "Learn Vertical Translation concepts. Practice with exercises. Master the material.";
      const result = createSEODescription([text], { maxLength: 50 });
      // Should keep "Learn Vertical Translation" if possible
      expect(result).toContain("Learn");
    });

    it("produces clean descriptions without ellipsis", () => {
      // Google prefers complete, natural descriptions without ellipsis
      const testCases = [
        {
          parts: [
            "Short",
            "Additional context that extends the description significantly",
          ],
          opts: { minLength: 20, maxLength: 50 },
        },
        {
          parts: ["A".repeat(200)],
          opts: { maxLength: 100 },
        },
      ];

      for (const testCase of testCases) {
        const result = createSEODescription(testCase.parts, testCase.opts);
        // Should never have ellipsis
        expect(result.endsWith("...")).toBe(false);
        expect(result.includes("...")).toBe(false);
      }
    });
  });
});
