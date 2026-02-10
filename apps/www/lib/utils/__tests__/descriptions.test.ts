import { describe, expect, it } from "vitest";
import { createSEODescription } from "../seo/descriptions";

const LETTER_REGEX = /^[a-zA-Z]$/;

describe("createSEODescription", () => {
  describe("basic functionality", () => {
    it("returns single part when only one valid part", () => {
      const result = createSEODescription(["Single description"]);
      expect(result).toBe("Single description");
    });

    it("joins multiple parts with period separator", () => {
      const result = createSEODescription(["First part", "Second part"]);
      expect(result).toBe("First part. Second part");
    });

    it("joins three or more parts", () => {
      const result = createSEODescription(["A", "B", "C"]);
      expect(result).toBe("A. B. C");
    });

    it("skips null and undefined values", () => {
      const result = createSEODescription([
        null,
        "Valid",
        undefined,
        "Also valid",
      ]);
      expect(result).toBe("Valid. Also valid");
    });

    it("skips empty strings and whitespace", () => {
      const result = createSEODescription(["", "   ", "Valid", "\t\n"]);
      expect(result).toBe("Valid");
    });

    it("returns empty string when no valid parts", () => {
      const result = createSEODescription([null, undefined, ""]);
      expect(result).toBe("");
    });

    it("trims whitespace from parts", () => {
      const result = createSEODescription(["  First  ", "  Second  "]);
      expect(result).toBe("First. Second");
    });
  });

  describe("length handling", () => {
    it("returns description under max length as-is", () => {
      const result = createSEODescription(["Short description"]);
      expect(result).toBe("Short description");
    });

    it("truncates at word boundary when over max length", () => {
      const longText = "A".repeat(200);
      const result = createSEODescription([longText], { maxLength: 50 });
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith("...")).toBe(false);
    });

    it("respects custom maxLength", () => {
      const result = createSEODescription(["A".repeat(100)], { maxLength: 30 });
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it("handles exact max length", () => {
      const exact = "A".repeat(160);
      const result = createSEODescription([exact]);
      expect(result).toBe(exact);
    });

    it("handles slightly over max length", () => {
      const slightlyOver = "A B ".repeat(50);
      const result = createSEODescription([slightlyOver]);
      expect(result.length).toBeLessThanOrEqual(160);
    });
  });

  describe("word boundary truncation", () => {
    it("does not cut words in half", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const result = createSEODescription([text], { maxLength: 25 });
      const lastChar = result.slice(-1);
      expect(lastChar === " " || LETTER_REGEX.test(lastChar)).toBe(true);
      if (result.length < text.length) {
        const nextChar = text[result.length];
        expect(nextChar).toBe(" ");
      }
    });

    it("truncates at last space before limit", () => {
      const text = "Word1 Word2 Word3 Word4 Word5 Word6 Word7";
      const result = createSEODescription([text], { maxLength: 30 });
      expect(result.endsWith("...")).toBe(false);
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it("handles hard truncate when no good word boundary", () => {
      const longWord = "Supercalifragilisticexpialidocious";
      const result = createSEODescription([longWord], { maxLength: 20 });
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe("real-world SEO scenarios", () => {
    it("handles typical content description", () => {
      const result = createSEODescription([
        "Learn about vertical translation in function transformation",
        "This concept is fundamental to understanding graph movements",
      ]);
      expect(result).toContain("Learn about");
      expect(result).toContain("fundamental");
    });

    it("handles fallback chain", () => {
      const result = createSEODescription([
        null,
        "Fallback description that works",
      ]);
      expect(result).toBe("Fallback description that works");
    });

    it("handles partial fallback chain", () => {
      const result = createSEODescription([
        "Primary",
        null,
        "Secondary",
        undefined,
        "Tertiary",
      ]);
      expect(result).toBe("Primary. Secondary. Tertiary");
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
        "Description with émojis 🎉 and spëciål chars",
      ]);
      expect(result).toContain("émojis");
    });

    it("handles very long single word", () => {
      const longWord = "a".repeat(200);
      const result = createSEODescription([longWord]);
      expect(result.length).toBeLessThanOrEqual(160);
      expect(result.endsWith("...")).toBe(false);
    });

    it("handles empty array", () => {
      const result = createSEODescription([]);
      expect(result).toBe("");
    });
  });

  describe("SEO compliance", () => {
    it("never exceeds maxLength", () => {
      const testCases = [
        ["A".repeat(200)],
        ["Short", "A".repeat(200)],
        ["A".repeat(100), "B".repeat(100)],
      ];

      for (const parts of testCases) {
        const result = createSEODescription(parts);
        expect(result.length).toBeLessThanOrEqual(160);
      }
    });

    it("never returns undefined or null", () => {
      const result = createSEODescription([]);
      expect(result).toBe("");
      expect(typeof result).toBe("string");
    });

    it("produces clean descriptions without ellipsis", () => {
      const testCases = [
        ["A".repeat(200)],
        ["Short", "A".repeat(200)],
        ["First part", "Second part", "Third part that is very long indeed"],
      ];

      for (const parts of testCases) {
        const result = createSEODescription(parts);
        expect(result.includes("...")).toBe(false);
        expect(result.endsWith("...")).toBe(false);
      }
    });

    it("preserves important content in concatenation", () => {
      const result = createSEODescription([
        "Learn Vertical Translation",
        "Practice with exercises",
        "Master the material",
      ]);
      expect(result).toContain("Learn");
      expect(result).toContain("Practice");
      expect(result).toContain("Master");
    });
  });
});
