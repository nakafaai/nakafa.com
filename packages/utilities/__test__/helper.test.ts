import { cleanSlug, createStableId } from "@repo/utilities/helper";
import { describe, expect, it } from "vitest";

const STABLE_JSON_LD_ID_PATTERN = /^json-ld-[a-z0-9]+$/;

describe("cleanSlug", () => {
  describe("Happy Paths", () => {
    it("should remove leading slash", () => {
      expect(cleanSlug("/hello")).toBe("hello");
    });

    it("should remove trailing slash", () => {
      expect(cleanSlug("hello/")).toBe("hello");
    });

    it("should remove both leading and trailing slashes", () => {
      expect(cleanSlug("/hello/")).toBe("hello");
    });

    it("should handle multiple leading slashes", () => {
      expect(cleanSlug("///hello")).toBe("hello");
    });

    it("should handle multiple trailing slashes", () => {
      expect(cleanSlug("hello///")).toBe("hello");
    });

    it("should handle slashes on both ends", () => {
      expect(cleanSlug("///hello///")).toBe("hello");
    });

    it("should preserve internal slashes", () => {
      expect(cleanSlug("/hello/world/")).toBe("hello/world");
    });

    it("should preserve nested path structure", () => {
      expect(cleanSlug("/a/b/c/d/e/")).toBe("a/b/c/d/e");
    });

    it("should handle single segment paths", () => {
      expect(cleanSlug("single")).toBe("single");
    });

    it("should handle path with no slashes", () => {
      expect(cleanSlug("hello-world")).toBe("hello-world");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      expect(cleanSlug("")).toBe("");
    });

    it("should handle only slashes", () => {
      expect(cleanSlug("///")).toBe("");
    });

    it("should handle string with only spaces and slashes", () => {
      expect(cleanSlug("/// ")).toBe(" ");
    });

    it("should handle single slash", () => {
      expect(cleanSlug("/")).toBe("");
    });

    it("should preserve special characters", () => {
      expect(cleanSlug("/hello-world_test/")).toBe("hello-world_test");
    });

    it("should preserve numbers in path", () => {
      expect(cleanSlug("/path/123/")).toBe("path/123");
    });

    it("should preserve hyphens", () => {
      expect(cleanSlug("/some-long-slug/")).toBe("some-long-slug");
    });

    it("should preserve underscores", () => {
      expect(cleanSlug("/some_long_slug/")).toBe("some_long_slug");
    });

    it("should preserve dots in filename", () => {
      expect(cleanSlug("/path/to/file.txt")).toBe("path/to/file.txt");
    });
  });

  describe("Unicode and Special Characters", () => {
    it("should handle Unicode characters", () => {
      expect(cleanSlug("/café/")).toBe("café");
    });

    it("should handle emoji in path", () => {
      expect(cleanSlug("/🎉/hello/")).toBe("🎉/hello");
    });

    it("should handle non-ASCII characters", () => {
      expect(cleanSlug("/日本語/")).toBe("日本語");
    });

    it("should handle Arabic characters", () => {
      expect(cleanSlug("/مرحبا/")).toBe("مرحبا");
    });

    it("should handle Chinese characters", () => {
      expect(cleanSlug("/你好/")).toBe("你好");
    });
  });

  describe("Real-World Examples", () => {
    it("should handle article slug", () => {
      const slug = "/articles/politics/dynastic-politics-asian-values/";
      expect(cleanSlug(slug)).toBe(
        "articles/politics/dynastic-politics-asian-values"
      );
    });

    it("should handle subject slug", () => {
      const slug = "/curriculum/high-school/10/mathematics/";
      expect(cleanSlug(slug)).toBe("curriculum/high-school/10/mathematics");
    });

    it("should handle nested try-out slug", () => {
      const slug = "/try-out/indonesia/snbt/set-1/quantitative-knowledge/";
      expect(cleanSlug(slug)).toBe(
        "try-out/indonesia/snbt/set-1/quantitative-knowledge"
      );
    });

    it("should handle Quran route", () => {
      const slug = "/quran/1/";
      expect(cleanSlug(slug)).toBe("quran/1");
    });

    it("should handle locale-prefixed path", () => {
      const slug = "/en/articles/politics/";
      expect(cleanSlug(slug)).toBe("en/articles/politics");
    });
  });

  describe("Multiple Slashes Between Segments", () => {
    it("should preserve multiple slashes between segments (not cleaning internal)", () => {
      expect(cleanSlug("hello//world")).toBe("hello//world");
    });

    it("should preserve multiple slashes between segments in longer path", () => {
      expect(cleanSlug("/a//b///c//")).toBe("a//b///c");
    });
  });

  describe("Whitespace Handling", () => {
    it("should preserve leading whitespace before slash", () => {
      expect(cleanSlug("  /hello")).toBe("  /hello");
    });

    it("should preserve trailing whitespace after slash", () => {
      expect(cleanSlug("/hello  ")).toBe("hello  ");
    });

    it("should preserve whitespace in segments", () => {
      expect(cleanSlug("/hello world/")).toBe("hello world");
    });
  });

  describe("Mixed Content", () => {
    it("should handle path with numbers, hyphens, and underscores", () => {
      expect(cleanSlug("/path-123/with_underscores/")).toBe(
        "path-123/with_underscores"
      );
    });

    it("should handle path with dots and extensions", () => {
      expect(cleanSlug("/files/document.pdf/images/thumb.png/")).toBe(
        "files/document.pdf/images/thumb.png"
      );
    });

    it("should handle complex real-world URL", () => {
      const slug =
        "/en/material/lesson/mathematics/exponential-logarithm/basic-concept/";
      expect(cleanSlug(slug)).toBe(
        "en/material/lesson/mathematics/exponential-logarithm/basic-concept"
      );
    });
  });

  describe("Boundary Cases", () => {
    it("should handle very long path", () => {
      const longPath = "/".repeat(100);
      expect(cleanSlug(longPath)).toBe("");
    });

    it("should handle path with many segments", () => {
      const manySegments =
        "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/";
      expect(cleanSlug(manySegments)).toBe(
        "a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z"
      );
    });

    it("should handle single character paths", () => {
      expect(cleanSlug("/a/")).toBe("a");
    });
  });
});

describe("createStableId", () => {
  it("returns the same id for the same prefix and payload", () => {
    const payload = JSON.stringify({ "@type": "WebSite", name: "Nakafa" });

    expect(createStableId("json-ld", payload)).toBe(
      createStableId("json-ld", payload)
    );
  });

  it("keeps the caller-provided prefix readable", () => {
    expect(createStableId("json-ld", "Nakafa")).toMatch(
      STABLE_JSON_LD_ID_PATTERN
    );
  });

  it("returns different ids for different payloads", () => {
    expect(createStableId("json-ld", "Nakafa")).not.toBe(
      createStableId("json-ld", "Nakafa AI")
    );
  });
});
