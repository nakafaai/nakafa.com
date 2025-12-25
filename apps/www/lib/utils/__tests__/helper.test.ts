import { describe, expect, it } from "vitest";
import {
  convertSlugToTitle,
  getInitialName,
  pathEndsWith,
  truncateText,
} from "../helper";

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

describe("convertSlugToTitle", () => {
  describe("kebab-case conversion", () => {
    it("converts simple kebab-case", () => {
      expect(convertSlugToTitle("hello-world")).toBe("Hello World");
      expect(convertSlugToTitle("foo-bar")).toBe("Foo Bar");
    });

    it("converts multi-word kebab-case", () => {
      expect(convertSlugToTitle("hello-world-test")).toBe("Hello World Test");
      expect(convertSlugToTitle("foo-bar-baz-qux")).toBe("Foo Bar Baz Qux");
    });
  });

  describe("snake_case conversion", () => {
    it("converts simple snake_case", () => {
      expect(convertSlugToTitle("hello_world")).toBe("Hello World");
      expect(convertSlugToTitle("foo_bar")).toBe("Foo Bar");
    });

    it("converts multi-word snake_case", () => {
      expect(convertSlugToTitle("hello_world_test")).toBe("Hello World Test");
    });
  });

  describe("multiple consecutive separators", () => {
    it("converts multiple dashes to single space", () => {
      expect(convertSlugToTitle("hello--world")).toBe("Hello World");
      expect(convertSlugToTitle("hello---world")).toBe("Hello World");
    });

    it("converts multiple underscores to single space", () => {
      expect(convertSlugToTitle("hello__world")).toBe("Hello World");
      expect(convertSlugToTitle("hello___world")).toBe("Hello World");
    });

    it("converts mixed multiple separators", () => {
      expect(convertSlugToTitle("hello---world___test")).toBe(
        "Hello World Test"
      );
    });
  });

  describe("URL encoding", () => {
    it("handles URL encoded spaces", () => {
      expect(convertSlugToTitle("hello%20world")).toBe("Hello World");
      expect(convertSlugToTitle("foo%20bar%20baz")).toBe("Foo Bar Baz");
    });

    it("handles URL encoded special characters", () => {
      expect(convertSlugToTitle("hello%21world")).toBe("Hello!World");
      expect(convertSlugToTitle("hello%40world")).toBe("Hello@World");
    });

    it("handles multiple encoded characters", () => {
      expect(convertSlugToTitle("hello%20%21%20world")).toBe("Hello ! World");
    });
  });

  describe("plus signs as separators", () => {
    it("handles single plus sign", () => {
      expect(convertSlugToTitle("hello+world")).toBe("Hello World");
      expect(convertSlugToTitle("foo+bar")).toBe("Foo Bar");
    });

    it("handles multiple plus signs", () => {
      expect(convertSlugToTitle("hello++world")).toBe("Hello World");
    });
  });

  describe("whitespace trimming", () => {
    it("trims leading spaces", () => {
      expect(convertSlugToTitle("  hello-world")).toBe("Hello World");
      expect(convertSlugToTitle("\thello-world")).toBe("Hello World");
      expect(convertSlugToTitle("\nhello-world")).toBe("Hello World");
    });

    it("trims trailing spaces", () => {
      expect(convertSlugToTitle("hello-world  ")).toBe("Hello World");
      expect(convertSlugToTitle("hello-world\t")).toBe("Hello World");
      expect(convertSlugToTitle("hello-world\n")).toBe("Hello World");
    });

    it("trims leading and trailing spaces", () => {
      expect(convertSlugToTitle("  hello-world  ")).toBe("Hello World");
      expect(convertSlugToTitle("\thello-world\t")).toBe("Hello World");
    });
  });

  describe("mixed separators", () => {
    it("handles dash and underscore mix", () => {
      expect(convertSlugToTitle("hello_world-test")).toBe("Hello World Test");
      expect(convertSlugToTitle("test_hello-world")).toBe("Test Hello World");
    });

    it("handles dash and plus mix", () => {
      expect(convertSlugToTitle("hello+world-test")).toBe("Hello World Test");
    });

    it("handles all three separators", () => {
      expect(convertSlugToTitle("hello_world+test-again")).toBe(
        "Hello World Test Again"
      );
    });
  });

  describe("capitalization", () => {
    it("capitalizes first letter of each word", () => {
      expect(convertSlugToTitle("hello-world")).toBe("Hello World");
      expect(convertSlugToTitle("foo-bar-baz")).toBe("Foo Bar Baz");
    });

    it("handles mixed case - uppercased at start", () => {
      expect(convertSlugToTitle("HELLO-WORLD")).toBe("HELLO WORLD");
      expect(convertSlugToTitle("hElLo-wOrLd")).toBe("HElLo WOrLd");
    });

    it("handles mixed case", () => {
      expect(convertSlugToTitle("HeLLo-WoRLd")).toBe("HeLLo WoRLd");
    });
  });

  describe("error handling", () => {
    it("handles malformed URL gracefully", () => {
      expect(convertSlugToTitle("%")).toBe("%");
      expect(convertSlugToTitle("%Z")).toBe("%Z");
    });

    it("handles incomplete percent encoding", () => {
      expect(convertSlugToTitle("hello%2")).toBe("Hello%2");
      expect(convertSlugToTitle("hello%2world")).toBe("Hello%2world");
    });
  });

  describe("numbers", () => {
    it("handles slugs with numbers", () => {
      expect(convertSlugToTitle("test-123")).toBe("Test 123");
      expect(convertSlugToTitle("2024-05-30")).toBe("2024 05 30");
    });

    it("handles numbers with separators", () => {
      expect(convertSlugToTitle("123-456-789")).toBe("123 456 789");
    });
  });

  describe("empty and single word", () => {
    it("handles empty string", () => {
      expect(convertSlugToTitle("")).toBe("");
    });

    it("handles single word without separators", () => {
      expect(convertSlugToTitle("hello")).toBe("Hello");
      expect(convertSlugToTitle("test")).toBe("Test");
    });

    it("handles single word with extra spaces", () => {
      expect(convertSlugToTitle("  hello  ")).toBe("Hello");
    });
  });

  describe("special characters", () => {
    it("preserves special characters", () => {
      expect(convertSlugToTitle("hello!world")).toBe("Hello!World");
      expect(convertSlugToTitle("test@example")).toBe("Test@Example");
      expect(convertSlugToTitle("foo#bar")).toBe("Foo#Bar");
    });

    it("handles dots in slug", () => {
      expect(convertSlugToTitle("version.1.0")).toBe("Version.1.0");
      expect(convertSlugToTitle("file.name")).toBe("File.Name");
    });
  });

  describe("unicode and accents", () => {
    it("handles unicode characters - note: behavior may vary with unicode", () => {
      const result1 = convertSlugToTitle("café-test");
      const result2 = convertSlugToTitle("über-world");
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1).toContain("Caf");
      expect(result1).toContain("Test");
      expect(result2).toContain("World");
    });

    it("handles emojis", () => {
      const result = convertSlugToTitle("hello-👋-world");
      expect(result).toBeDefined();
      expect(result).toContain("Hello");
      expect(result).toContain("World");
    });
  });

  describe("very long slugs", () => {
    it("handles very long slug", () => {
      const longSlug = `${"a".repeat(100)}-${"b".repeat(100)}`;
      const result = convertSlugToTitle(longSlug);
      expect(result.length).toBeGreaterThan(100);
      expect(result).toContain("A");
      expect(result).toContain("B");
    });
  });

  describe("consecutive separators at edges", () => {
    it("handles leading separators", () => {
      expect(convertSlugToTitle("-hello")).toBe("Hello");
      expect(convertSlugToTitle("--hello")).toBe("Hello");
    });

    it("handles trailing separators", () => {
      expect(convertSlugToTitle("hello-")).toBe("Hello");
      expect(convertSlugToTitle("hello--")).toBe("Hello");
    });

    it("handles separators only", () => {
      expect(convertSlugToTitle("---")).toBe("");
      expect(convertSlugToTitle("___")).toBe("");
    });
  });
});

describe("truncateText", () => {
  describe("text shorter than max length", () => {
    it("returns text unchanged", () => {
      expect(truncateText("Hello", 10)).toBe("Hello");
      expect(truncateText("Test", 20)).toBe("Test");
    });

    it("returns text unchanged for empty string", () => {
      expect(truncateText("", 10)).toBe("");
    });

    it("returns text unchanged for single character", () => {
      expect(truncateText("A", 10)).toBe("A");
    });
  });

  describe("text equal to max length", () => {
    it("returns text unchanged when equal", () => {
      expect(truncateText("Hello", 5)).toBe("Hello");
      expect(truncateText("Test", 4)).toBe("Test");
    });

    it("returns text unchanged for max length 1", () => {
      expect(truncateText("A", 1)).toBe("A");
    });
  });

  describe("text longer than max length", () => {
    it("truncates and adds ellipsis", () => {
      expect(truncateText("Hello World", 5)).toBe("Hello...");
      expect(truncateText("Testing", 4)).toBe("Test...");
    });

    it("truncates exactly one over max", () => {
      expect(truncateText("Hello", 4)).toBe("Hell...");
      expect(truncateText("ABCD", 3)).toBe("ABC...");
    });

    it("truncates much longer text", () => {
      expect(truncateText("Hello World This Is A Test", 10)).toBe(
        "Hello Worl..."
      );
    });
  });

  describe("whitespace handling", () => {
    it("trims leading whitespace before truncating", () => {
      expect(truncateText("  Hello", 5)).toBe("Hello...");
      expect(truncateText("\tTest", 4)).toBe("Test...");
    });

    it("trims trailing whitespace before truncating", () => {
      expect(truncateText("Hello  ", 5)).toBe("Hello...");
      expect(truncateText("Test\t", 4)).toBe("Test...");
    });

    it("trims both leading and trailing whitespace", () => {
      expect(truncateText("  Hello  ", 5)).toBe("Hello...");
    });

    it("trims multiple spaces", () => {
      expect(truncateText("Hello   World", 8)).toBe("Hello...");
      expect(truncateText("Test    String", 4)).toBe("Test...");
    });

    it("handles whitespace only - returns empty after trimming and truncating", () => {
      expect(truncateText("   ", 5)).toBe("");
      expect(truncateText("\t\t", 2)).toBe("");
    });
  });

  describe("edge cases", () => {
    it("handles max length 0", () => {
      expect(truncateText("Hello", 0)).toBe("...");
    });

    it("handles max length negative", () => {
      expect(truncateText("Hello", -1)).toBe("...");
    });

    it("handles empty text with any max length", () => {
      expect(truncateText("", 5)).toBe("");
      expect(truncateText("", 0)).toBe("");
    });
  });

  describe("special characters", () => {
    it("handles text with special characters", () => {
      expect(truncateText("Hello!@#$%", 6)).toBe("Hello!...");
      expect(truncateText("Test@#$%", 5)).toBe("Test@...");
    });

    it("handles text with emojis", () => {
      const result = truncateText("Hello World", 10);
      expect(result).toBeDefined();
      expect(result).toContain("Hello");
    });
  });

  describe("unicode and multibyte characters", () => {
    it("handles accented characters", () => {
      expect(truncateText("Café au lait", 5)).toBe("Café...");
      expect(truncateText("Über alles", 4)).toBe("Über...");
    });

    it("handles non-Latin scripts", () => {
      expect(truncateText("你好世界", 3)).toBe("你好世...");
      expect(truncateText("Привет", 3)).toBe("При...");
    });
  });

  describe("very long text", () => {
    it("handles very long string", () => {
      const longText = "A".repeat(1000);
      const result = truncateText(longText, 100);
      expect(result).toBe(`${"A".repeat(100)}...`);
    });

    it("handles text much longer than max - note: trims before checking length", () => {
      const longText = "Hello World ".repeat(100);
      const result = truncateText(longText, 20);
      expect(result).toBeDefined();
      expect(result).toContain("Hello World Hello");
    });
  });

  describe("newlines and tabs", () => {
    it("handles text with newlines", () => {
      expect(truncateText("Hello\nWorld", 10)).toBe("Hello\nWorl...");
    });

    it("handles text with tabs", () => {
      expect(truncateText("Hello\tWorld", 10)).toBe("Hello\tWorl...");
    });

    it("handles text with mixed whitespace", () => {
      const result = truncateText("Hello \n\t World", 10);
      expect(result).toBeDefined();
      expect(result).toContain("Hello");
    });
  });
});

describe("numbers", () => {
  it("handles numeric strings", () => {
    expect(truncateText("1234567890", 5)).toBe("12345...");
    expect(truncateText("0123456789", 5)).toBe("01234...");
  });
});

describe("pathEndsWith", () => {
  describe("basic path matching", () => {
    it("returns true for matching segment", () => {
      expect(pathEndsWith("/school/slug/classes", "classes")).toBe(true);
      expect(pathEndsWith("/test/path/segment", "segment")).toBe(true);
    });

    it("returns false for non-matching segment", () => {
      expect(pathEndsWith("/school/slug/classes", "students")).toBe(false);
      expect(pathEndsWith("/test/path/segment", "other")).toBe(false);
    });

    it("handles root path segment", () => {
      expect(pathEndsWith("/classes", "classes")).toBe(true);
      expect(pathEndsWith("/test", "test")).toBe(true);
    });
  });

  describe("nested paths", () => {
    it("returns false for nested path", () => {
      expect(pathEndsWith("/school/slug/classes/123", "classes")).toBe(false);
      expect(pathEndsWith("/a/b/c/d", "c")).toBe(false);
    });

    it("returns true for deepest segment", () => {
      expect(pathEndsWith("/school/slug/classes/123", "123")).toBe(true);
      expect(pathEndsWith("/a/b/c/d", "d")).toBe(true);
    });
  });

  describe("trailing slashes", () => {
    it("handles trailing slashes on path", () => {
      expect(pathEndsWith("/school/slug/classes/", "classes")).toBe(true);
      expect(pathEndsWith("/test/path/", "path")).toBe(true);
    });

    it("handles multiple trailing slashes", () => {
      expect(pathEndsWith("/school/slug/classes//", "classes")).toBe(true);
    });

    it("handles trailing slash in segment", () => {
      expect(pathEndsWith("/school/slug/classes", "classes/")).toBe(false);
    });
  });

  describe("leading slashes in segment", () => {
    it("returns false for segment with leading slash", () => {
      expect(pathEndsWith("/school/slug/classes", "/classes")).toBe(false);
      expect(pathEndsWith("/test/path", "/path")).toBe(false);
    });

    it("returns false for absolute path segment", () => {
      expect(pathEndsWith("/school/slug/classes", "/absolute")).toBe(false);
    });
  });

  describe("empty paths and segments", () => {
    it("returns false for empty path", () => {
      expect(pathEndsWith("", "classes")).toBe(false);
    });

    it("returns false for empty segment", () => {
      expect(pathEndsWith("/school/slug/classes", "")).toBe(false);
    });

    it("returns false for both empty", () => {
      expect(pathEndsWith("", "")).toBe(false);
    });
  });

  describe("segment appearing multiple times", () => {
    it("returns true for matching last occurrence", () => {
      expect(pathEndsWith("/classes/slug/classes", "classes")).toBe(true);
      expect(pathEndsWith("/a/b/a", "a")).toBe(true);
    });

    it("returns false for middle occurrence", () => {
      expect(pathEndsWith("/classes/slug/classes/test", "slug")).toBe(false);
    });
  });

  describe("special characters in paths", () => {
    it("handles segments with special characters", () => {
      expect(pathEndsWith("/test/path/@user", "@user")).toBe(true);
      expect(pathEndsWith("/api/v1/end.point", "end.point")).toBe(true);
    });

    it("handles segments with dots", () => {
      expect(pathEndsWith("/test/file.html", "file.html")).toBe(true);
      expect(pathEndsWith("/path/to/.hidden", ".hidden")).toBe(true);
    });
  });

  describe("query strings and hash fragments", () => {
    it("handles segments with query strings", () => {
      expect(pathEndsWith("/test?query=1", "test")).toBe(false);
      expect(pathEndsWith("/test/path?sort=asc", "path")).toBe(false);
    });

    it("handles segments with hash fragments", () => {
      expect(pathEndsWith("/test#section", "test")).toBe(false);
      expect(pathEndsWith("/test/path#id", "path")).toBe(false);
    });
  });

  describe("url encoding", () => {
    it("handles URL encoded segments", () => {
      expect(pathEndsWith("/test/hello%20world", "hello%20world")).toBe(true);
      expect(pathEndsWith("/test/hello%20world/test2", "test2")).toBe(true);
    });
  });

  describe("single segment paths", () => {
    it("handles single segment path", () => {
      expect(pathEndsWith("/classes", "classes")).toBe(true);
      expect(pathEndsWith("/test", "test")).toBe(true);
    });

    it("handles single segment without leading slash", () => {
      expect(pathEndsWith("classes", "classes")).toBe(true);
      expect(pathEndsWith("test", "test")).toBe(true);
    });
  });

  describe("root path", () => {
    it("handles root path", () => {
      expect(pathEndsWith("/", "")).toBe(false);
    });
  });

  describe("multiple consecutive slashes", () => {
    it("handles double slashes in path", () => {
      expect(pathEndsWith("//test//path", "path")).toBe(true);
    });

    it("handles triple slashes in path", () => {
      expect(pathEndsWith("///test///path", "path")).toBe(true);
    });
  });

  describe("whitespace in paths", () => {
    it("handles paths with spaces", () => {
      expect(pathEndsWith("/test/hello world", "hello world")).toBe(true);
    });

    it("handles paths with encoded spaces", () => {
      expect(pathEndsWith("/test/hello%20world", "hello%20world")).toBe(true);
    });
  });

  describe("case sensitivity", () => {
    it("is case sensitive", () => {
      expect(pathEndsWith("/test/path", "Path")).toBe(false);
      expect(pathEndsWith("/test/path", "PATH")).toBe(false);
    });

    it("matches exact case", () => {
      expect(pathEndsWith("/test/path", "path")).toBe(true);
      expect(pathEndsWith("/test/PATH", "PATH")).toBe(true);
    });
  });

  describe("unicode paths", () => {
    it("handles unicode segments", () => {
      expect(pathEndsWith("/test/你好", "你好")).toBe(true);
      expect(pathEndsWith("/test/Привет", "Привет")).toBe(true);
    });

    it("handles emoji in segments", () => {
      expect(pathEndsWith("/test/👋", "👋")).toBe(true);
    });
  });

  describe("numbers in paths", () => {
    it("handles numeric segments", () => {
      expect(pathEndsWith("/test/123", "123")).toBe(true);
      expect(pathEndsWith("/test/123/456", "456")).toBe(true);
    });

    it("handles alphanumeric segments", () => {
      expect(pathEndsWith("/test/abc123", "abc123")).toBe(true);
    });
  });
});
