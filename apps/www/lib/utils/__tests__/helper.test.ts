import { describe, expect, it } from "vitest";
import { getInitialName } from "../helper";

describe("getInitialName", () => {
  describe("default fallback", () => {
    it("returns 'NF' for undefined", () => {
      expect(getInitialName()).toBe("NF");
    });

    it("returns 'NF' for empty string", () => {
      expect(getInitialName("")).toBe("NF");
    });

    it("returns 'NF' for whitespace only", () => {
      expect(getInitialName("   ")).toBe("NF");
      expect(getInitialName("\t")).toBe("NF");
      expect(getInitialName("\n")).toBe("NF");
    });
  });

  describe("single name handling", () => {
    it("returns first letter for single character name", () => {
      expect(getInitialName("A")).toBe("A");
      expect(getInitialName("a")).toBe("A");
    });

    it("returns first letter for single name", () => {
      expect(getInitialName("John")).toBe("J");
      expect(getInitialName("Sarah")).toBe("S");
    });

    it("returns first letter for single name with extra spaces", () => {
      expect(getInitialName("  John  ")).toBe("J");
      expect(getInitialName("\tSarah\n")).toBe("S");
    });
  });

  describe("two names handling", () => {
    it("returns initials for two names", () => {
      expect(getInitialName("John Doe")).toBe("JD");
      expect(getInitialName("Sarah Smith")).toBe("SS");
    });

    it("handles extra spaces between names", () => {
      expect(getInitialName("John  Doe")).toBe("JD");
      expect(getInitialName("John   Doe")).toBe("JD");
    });
  });

  describe("multiple names handling", () => {
    it("returns first and last initials for three names", () => {
      expect(getInitialName("John Michael Doe")).toBe("JD");
      expect(getInitialName("Sarah Jane Smith")).toBe("SS");
    });

    it("returns first and last initials for four names", () => {
      expect(getInitialName("John Michael William Doe")).toBe("JD");
    });

    it("returns first and last initials for many names", () => {
      expect(getInitialName("A B C D E F")).toBe("AF");
    });
  });

  describe("case handling", () => {
    it("handles all lowercase", () => {
      expect(getInitialName("john doe")).toBe("JD");
    });

    it("handles all uppercase", () => {
      expect(getInitialName("JOHN DOE")).toBe("JD");
    });

    it("handles mixed case", () => {
      expect(getInitialName("JoHn dOE")).toBe("JD");
      expect(getInitialName("jOhN DoE")).toBe("JD");
    });

    it("handles title case", () => {
      expect(getInitialName("John Doe")).toBe("JD");
    });
  });

  describe("special characters", () => {
    it("handles names with hyphens", () => {
      expect(getInitialName("Mary-Jane")).toBe("M");
      expect(getInitialName("Mary-Jane Smith")).toBe("MS");
    });

    it("handles names with apostrophes", () => {
      expect(getInitialName("O'Connor")).toBe("O");
      expect(getInitialName("John O'Connor")).toBe("JO");
    });

    it("handles names with periods", () => {
      expect(getInitialName("Dr. Smith")).toBe("DS");
      expect(getInitialName("A. B. C.")).toBe("AC");
    });
  });

  describe("unicode and international names", () => {
    it("handles accented characters", () => {
      expect(getInitialName("José")).toBe("J");
      expect(getInitialName("José García")).toBe("JG");
    });

    it("handles non-Latin characters", () => {
      expect(getInitialName("李明")).toBe("李");
      expect(getInitialName("李明 王")).toBe("李王");
    });

    it("handles emoji in names - note: behavior may vary with unicode", () => {
      const result1 = getInitialName("John 👨");
      const result2 = getInitialName("👨 John");
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1).toContain("J");
      expect(result2).toContain("J");
    });
  });

  describe("numbers in names", () => {
    it("handles names with numbers", () => {
      expect(getInitialName("John123")).toBe("J");
      expect(getInitialName("John 123 Smith")).toBe("JS");
    });

    it("handles names starting with numbers", () => {
      expect(getInitialName("123 John")).toBe("1J");
    });

    it("handles only numbers", () => {
      expect(getInitialName("123")).toBe("1");
      expect(getInitialName("123 456")).toBe("14");
    });
  });

  describe("very long names", () => {
    it("handles very long single name", () => {
      expect(getInitialName("A".repeat(1000))).toBe("A");
    });

    it("handles very long multiple names", () => {
      const longName = `${"A".repeat(1000)} ${"Z".repeat(1000)}`;
      expect(getInitialName(longName)).toBe("AZ");
    });
  });

  describe("edge cases", () => {
    it("handles single space", () => {
      expect(getInitialName(" ")).toBe("NF");
    });

    it("handles multiple consecutive spaces", () => {
      expect(getInitialName("    ")).toBe("NF");
      expect(getInitialName("     ")).toBe("NF");
    });

    it("handles mixed whitespace", () => {
      expect(getInitialName(" \t\n ")).toBe("NF");
    });

    it("handles single letter names", () => {
      expect(getInitialName("A")).toBe("A");
      expect(getInitialName("Z")).toBe("Z");
    });

    it("handles very short two letter names", () => {
      expect(getInitialName("A B")).toBe("AB");
    });
  });
});
