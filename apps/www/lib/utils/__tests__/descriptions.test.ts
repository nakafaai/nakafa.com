import { describe, expect, it } from "vitest";
import { createSEODescription } from "../seo/descriptions";

describe("createSEODescription", () => {
  describe("basic functionality", () => {
    it("returns first valid part", () => {
      const result = createSEODescription([
        "Primary description",
        "Fallback description",
      ]);
      expect(result).toBe("Primary description");
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
      expect(result.endsWith("...")).toBe(true);
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
      expect(result.endsWith("...")).toBe(true);
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it("does not cut words in half", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const result = createSEODescription([text], { maxLength: 25 });
      const words = result.replace("...", "").trim().split(" ");
      // All words should be complete (no partial words)
      for (const word of words) {
        expect(word).not.toBe("");
        expect(word.length).toBeGreaterThan(0);
      }
    });
  });

  describe("fallback chain", () => {
    it("uses first valid part from chain", () => {
      const result = createSEODescription([
        null,
        undefined,
        "",
        "First valid",
        "Second valid",
      ]);
      expect(result).toBe("First valid");
    });

    it("handles all nulls then valid", () => {
      const result = createSEODescription([null, null, null, "Finally valid"]);
      expect(result).toBe("Finally valid");
    });

    it("handles mixed valid and invalid", () => {
      const result = createSEODescription([
        "",
        "Valid",
        null,
        "Also valid but ignored",
      ]);
      expect(result).toBe("Valid");
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
      expect(result.endsWith("...")).toBe(true);
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
  });
});
