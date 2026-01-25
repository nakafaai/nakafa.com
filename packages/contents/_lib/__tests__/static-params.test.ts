import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import {
  generateAllContentParams,
  generateContentParams,
  getExerciseNumberPaths,
  getExerciseSetPaths,
} from "@repo/contents/_lib/static-params";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/cache");
vi.mock("@repo/contents/_lib/fs");
vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    locales: ["en", "id"],
  },
}));

describe("getExerciseSetPaths", () => {
  describe("basic functionality", () => {
    it("should export the function", () => {
      expect(getExerciseSetPaths).toBeDefined();
    });

    it("should return an empty array for empty input", () => {
      const result = getExerciseSetPaths([]);
      expect(result).toEqual([]);
    });

    it("should return an empty array when no exercise paths match", () => {
      const slugs = [
        "articles/my-article",
        "subject/math/algebra",
        "exercises/math/algebra",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual([]);
    });
  });

  describe("exercise path extraction", () => {
    it("should extract exercise set path from _question path", () => {
      const slugs = ["exercises/high-school/math/set-1/1/_question"];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual(["exercises/high-school/math/set-1"]);
    });

    it("should extract exercise set path from _answer path", () => {
      const slugs = ["exercises/high-school/math/set-1/1/_answer"];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual(["exercises/high-school/math/set-1"]);
    });

    it("should extract multiple exercise set paths", () => {
      const slugs = [
        "exercises/math/algebra/set-1/1/_question",
        "exercises/math/algebra/set-1/2/_question",
        "exercises/math/algebra/set-2/1/_question",
        "exercises/physics/mechanics/set-1/1/_answer",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toHaveLength(3);
      expect(result).toContain("exercises/math/algebra/set-1");
      expect(result).toContain("exercises/math/algebra/set-2");
      expect(result).toContain("exercises/physics/mechanics/set-1");
    });

    it("should deduplicate exercise set paths", () => {
      const slugs = [
        "exercises/math/set-1/1/_question",
        "exercises/math/set-1/1/_answer",
        "exercises/math/set-1/2/_question",
        "exercises/math/set-1/2/_answer",
        "exercises/math/set-1/3/_question",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual(["exercises/math/set-1"]);
    });

    it("should handle deeply nested exercise paths", () => {
      const slugs = [
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/1/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/1/_answer",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual([
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1",
      ]);
    });

    it("should handle multi-digit exercise numbers", () => {
      const slugs = [
        "exercises/math/set-1/10/_question",
        "exercises/math/set-1/99/_question",
        "exercises/math/set-1/100/_answer",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual(["exercises/math/set-1"]);
    });

    it("should not match paths that do not follow the pattern", () => {
      const slugs = [
        "exercises/math/set-1/abc/_question",
        "exercises/math/set-1/1/question",
        "exercises/math/set-1/1/_other",
        "exercises/math/set-1/_question",
        "other/path/1/_question",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle mixed valid and invalid paths", () => {
      const slugs = [
        "exercises/math/set-1/1/_question",
        "articles/my-article",
        "exercises/physics/set-2/5/_answer",
        "subject/biology",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result).toHaveLength(2);
      expect(result).toContain("exercises/math/set-1");
      expect(result).toContain("exercises/physics/set-2");
    });

    it("should preserve order of first occurrence", () => {
      const slugs = [
        "exercises/b/set-1/1/_question",
        "exercises/a/set-1/1/_question",
        "exercises/c/set-1/1/_question",
      ];
      const result = getExerciseSetPaths(slugs);
      expect(result[0]).toBe("exercises/b/set-1");
      expect(result[1]).toBe("exercises/a/set-1");
      expect(result[2]).toBe("exercises/c/set-1");
    });
  });
});

describe("getExerciseNumberPaths", () => {
  describe("basic functionality", () => {
    it("should export the function", () => {
      expect(getExerciseNumberPaths).toBeDefined();
    });

    it("should return an empty array for empty input", () => {
      const result = getExerciseNumberPaths([]);
      expect(result).toEqual([]);
    });

    it("should return an empty array when no exercise paths match", () => {
      const slugs = [
        "articles/my-article",
        "subject/math/algebra",
        "exercises/math/algebra",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toEqual([]);
    });
  });

  describe("exercise number path extraction", () => {
    it("should extract exercise number path from _question path", () => {
      const slugs = ["exercises/high-school/math/set-1/1/_question"];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toEqual(["exercises/high-school/math/set-1/1"]);
    });

    it("should extract exercise number path from _answer path", () => {
      const slugs = ["exercises/high-school/math/set-1/1/_answer"];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toEqual(["exercises/high-school/math/set-1/1"]);
    });

    it("should extract multiple exercise number paths", () => {
      const slugs = [
        "exercises/math/algebra/set-1/1/_question",
        "exercises/math/algebra/set-1/2/_question",
        "exercises/math/algebra/set-2/1/_question",
        "exercises/physics/mechanics/set-1/5/_answer",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toHaveLength(4);
      expect(result).toContain("exercises/math/algebra/set-1/1");
      expect(result).toContain("exercises/math/algebra/set-1/2");
      expect(result).toContain("exercises/math/algebra/set-2/1");
      expect(result).toContain("exercises/physics/mechanics/set-1/5");
    });

    it("should deduplicate exercise number paths", () => {
      const slugs = [
        "exercises/math/set-1/1/_question",
        "exercises/math/set-1/1/_answer",
        "exercises/math/set-1/2/_question",
        "exercises/math/set-1/2/_answer",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toHaveLength(2);
      expect(result).toContain("exercises/math/set-1/1");
      expect(result).toContain("exercises/math/set-1/2");
    });

    it("should handle deeply nested exercise paths", () => {
      const slugs = [
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/1/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/20/_answer",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toHaveLength(2);
      expect(result).toContain(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/1"
      );
      expect(result).toContain(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/20"
      );
    });

    it("should handle multi-digit exercise numbers", () => {
      const slugs = [
        "exercises/math/set-1/10/_question",
        "exercises/math/set-1/99/_question",
        "exercises/math/set-1/100/_answer",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toHaveLength(3);
      expect(result).toContain("exercises/math/set-1/10");
      expect(result).toContain("exercises/math/set-1/99");
      expect(result).toContain("exercises/math/set-1/100");
    });

    it("should not match paths that do not follow the pattern", () => {
      const slugs = [
        "exercises/math/set-1/abc/_question",
        "exercises/math/set-1/1/question",
        "exercises/math/set-1/1/_other",
        "exercises/math/set-1/_question",
        "other/path/1/_question",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle mixed valid and invalid paths", () => {
      const slugs = [
        "exercises/math/set-1/1/_question",
        "articles/my-article",
        "exercises/physics/set-2/5/_answer",
        "subject/biology",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result).toHaveLength(2);
      expect(result).toContain("exercises/math/set-1/1");
      expect(result).toContain("exercises/physics/set-2/5");
    });

    it("should preserve order of first occurrence", () => {
      const slugs = [
        "exercises/b/set-1/3/_question",
        "exercises/a/set-1/1/_question",
        "exercises/c/set-1/2/_question",
      ];
      const result = getExerciseNumberPaths(slugs);
      expect(result[0]).toBe("exercises/b/set-1/3");
      expect(result[1]).toBe("exercises/a/set-1/1");
      expect(result[2]).toBe("exercises/c/set-1/2");
    });
  });
});

describe("generateContentParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should export the function", () => {
      expect(generateContentParams).toBeDefined();
    });

    it("should return an array of static params", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should accept a config object with basePath", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      expect(() => {
        generateContentParams({
          basePath: "articles",
        });
      }).not.toThrow();
    });
  });

  describe("folder path generation", () => {
    it("should generate params for top-level folders", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1", "folder2"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThanOrEqual(4);
      const enResults = result.filter((r) => r.locale === "en");
      expect(enResults).toContainEqual({ locale: "en", slug: ["folder1"] });
      expect(enResults).toContainEqual({ locale: "en", slug: ["folder2"] });
    });

    it("should generate params for nested folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["parent"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([["child1"], ["child2"]]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThanOrEqual(6);
      const enResults = result.filter((r) => r.locale === "en");
      expect(enResults).toContainEqual({ locale: "en", slug: ["parent"] });
      expect(enResults).toContainEqual({
        locale: "en",
        slug: ["parent", "child1"],
      });
      expect(enResults).toContainEqual({
        locale: "en",
        slug: ["parent", "child2"],
      });
    });

    it("should generate params for deeply nested folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["level1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([
        ["level2", "level3", "level4"],
      ]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      const enResults = result.filter((r) => r.locale === "en");
      expect(enResults).toContainEqual({ locale: "en", slug: ["level1"] });
      expect(enResults).toContainEqual({
        locale: "en",
        slug: ["level1", "level2", "level3", "level4"],
      });
    });

    it("should handle empty folder list", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("MDX slug integration", () => {
    it("should include MDX slugs from cache", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["articles/my-article"]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["my-article"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["my-article"] });
    });

    it("should filter MDX slugs by basePath", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/article1",
        "exercises/exercise1",
        "articles/nested/article2",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(4);
      const enResults = result.filter((r) => r.locale === "en");
      expect(enResults).toContainEqual({ locale: "en", slug: ["article1"] });
      expect(enResults).toContainEqual({
        locale: "en",
        slug: ["nested", "article2"],
      });
    });

    it("should include MDX slugs that don't match folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder-with-content"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/article-without-folder",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(4);
      const enResults = result.filter((r) => r.locale === "en");
      expect(enResults).toContainEqual({
        locale: "en",
        slug: ["folder-with-content"],
      });
      expect(enResults).toContainEqual({
        locale: "en",
        slug: ["article-without-folder"],
      });
    });
  });

  describe("deduplication", () => {
    it("should not duplicate paths when MDX slug matches folder path", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["existing-folder"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/existing-folder",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["existing-folder"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["existing-folder"] });
    });

    it("should deduplicate across multiple locales", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["shared-folder"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/shared-folder",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["shared-folder"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["shared-folder"] });
    });

    it("should not deduplicate paths across different locales", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockImplementation((locale) => {
        if (locale === "en") {
          return ["articles/en-only"];
        }
        return ["articles/id-only"];
      });

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["en-only"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["id-only"] });
    });
  });

  describe("multi-locale support", () => {
    it("should generate params for all locales", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0].locale).toBe("en");
      expect(result[1].locale).toBe("id");
    });

    it("should combine folder paths for all locales", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockImplementation((locale) => {
        if (locale === "en") {
          return ["articles/en-folder"];
        }
        return ["articles/id-folder"];
      });

      const result = generateContentParams({
        basePath: "articles",
      });

      const enResults = result.filter((r) => r.locale === "en");
      const idResults = result.filter((r) => r.locale === "id");

      expect(enResults).toHaveLength(1);
      expect(idResults).toHaveLength(1);
      expect(enResults[0]).toEqual({ locale: "en", slug: ["en-folder"] });
      expect(idResults[0]).toEqual({ locale: "id", slug: ["id-folder"] });
    });

    it("should accept custom locales array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
        locales: ["de", "fr", "es"],
      });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.locale)).toEqual(["de", "fr", "es"]);
    });
  });

  describe("error handling", () => {
    it("should handle getFolderChildNames failure gracefully", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.fail(
          new DirectoryReadError({ path: "articles", cause: "test error" })
        )
      );
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle empty MDX slugs", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["folder1"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["folder1"] });
    });

    it("should handle getNestedSlugs returning empty array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["folder1"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["folder1"] });
    });

    it("should handle empty locales array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
        locales: [],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("exercises basePath special handling", () => {
    it("should include exercise set paths for exercises basePath", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["high-school"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([["math"]]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/high-school/math/set-1/1/_question",
        "exercises/high-school/math/set-1/1/_answer",
        "exercises/high-school/math/set-1/2/_question",
        "exercises/high-school/math/set-2/1/_question",
      ]);

      const result = generateContentParams({
        basePath: "exercises",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("high-school");
      expect(slugPaths).toContain("high-school/math");
      expect(slugPaths).toContain("high-school/math/set-1");
      expect(slugPaths).toContain("high-school/math/set-2");
    });

    it("should not duplicate exercise set paths that match folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["math"]));
      vi.mocked(getNestedSlugs).mockReturnValue([["set-1"]]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
      ]);

      const result = generateContentParams({
        basePath: "exercises",
      });

      const enResults = result.filter((r) => r.locale === "en");
      const set1Paths = enResults.filter(
        (r) => r.slug.join("/") === "math/set-1"
      );
      expect(set1Paths).toHaveLength(1);
    });

    it("should not include exercise set paths for non-exercises basePath", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["math"]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/math/set-1/1/_question",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).not.toContain("math/set-1");
    });
  });

  describe("complex scenarios", () => {
    it("should handle mixed folder and MDX slug scenarios", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1", "folder2", "folder3"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "articles/folder1") {
          return [["content1"], ["nested", "deep"]];
        }
        if (path === "articles/folder2") {
          return [];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/folder1/content1",
        "articles/content-without-folder",
        "articles/folder2",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThan(0);

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("folder1");
      expect(slugPaths).toContain("folder2");
      expect(slugPaths).toContain("folder3");
      expect(slugPaths).toContain("folder1/content1");
      expect(slugPaths).toContain("folder1/nested/deep");
      expect(slugPaths).toContain("content-without-folder");
    });

    it("should preserve slug array structure correctly", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["level1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([
        ["level2", "level3"],
        ["level2b", "level3b", "level4b"],
      ]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result).toHaveLength(6);
      expect(result[0].slug).toEqual(["level1"]);
      expect(result[1].slug).toEqual(["level1", "level2", "level3"]);
      expect(result[2].slug).toEqual([
        "level1",
        "level2b",
        "level3b",
        "level4b",
      ]);
      expect(result[3].slug).toEqual(["level1"]);
      expect(result[4].slug).toEqual(["level1", "level2", "level3"]);
      expect(result[5].slug).toEqual([
        "level1",
        "level2b",
        "level3b",
        "level4b",
      ]);
    });

    it("should handle basePath filtering correctly", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["correct", "another"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "articles/correct") {
          return [["path"]];
        }
        if (path === "articles/another") {
          return [["correct"]];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/correct/path",
        "exercises/wrong/path",
        "articles/another/correct",
      ]);

      const result = generateContentParams({
        basePath: "articles",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).not.toContain("wrong/path");
      expect(slugPaths).toContain("correct/path");
      expect(slugPaths).toContain("another/correct");
    });
  });

  describe("real-world scenarios", () => {
    it("should work with articles content structure", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["tech", "life"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "articles/tech") {
          return [["intro"], ["advanced"]];
        }
        if (path === "articles/life") {
          return [["journey"]];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockImplementation((locale) => {
        if (locale === "en") {
          return [
            "articles/tech/intro",
            "articles/life/journey",
            "articles/tech/advanced",
          ];
        }
        return ["articles/tech/perkenalan", "articles/life/perjalanan"];
      });

      const result = generateContentParams({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThan(0);

      const enResults = result.filter((r) => r.locale === "en");
      const idResults = result.filter((r) => r.locale === "id");

      expect(enResults.length).toBeGreaterThan(0);
      expect(idResults.length).toBeGreaterThan(0);
    });

    it("should work with exercises content structure", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["math", "physics"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "exercises/math") {
          return [["algebra"], ["calculus"]];
        }
        if (path === "exercises/physics") {
          return [["kinematics"], ["dynamics"]];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/algebra/set-1/1/_question",
        "exercises/math/algebra/set-1/2/_question",
        "exercises/physics/kinematics/set-1/1/_question",
      ]);

      const result = generateContentParams({
        basePath: "exercises",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("math");
      expect(slugPaths).toContain("physics");
      expect(slugPaths).toContain("math/algebra");
      expect(slugPaths).toContain("math/calculus");
      expect(slugPaths).toContain("math/algebra/set-1");
      expect(slugPaths).toContain("physics/kinematics/set-1");
    });

    it("should include specific exercise numbers from folder structure", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["high-school"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "exercises/high-school") {
          return [
            ["snbt"],
            ["snbt", "quantitative-knowledge"],
            ["snbt", "quantitative-knowledge", "try-out"],
            ["snbt", "quantitative-knowledge", "try-out", "set-1"],
            ["snbt", "quantitative-knowledge", "try-out", "set-1", "1"],
            ["snbt", "quantitative-knowledge", "try-out", "set-1", "2"],
            ["snbt", "quantitative-knowledge", "try-out", "set-1", "3"],
            ["snbt", "quantitative-knowledge", "try-out", "set-2"],
            ["snbt", "quantitative-knowledge", "try-out", "set-2", "1"],
            ["snbt", "quantitative-knowledge", "try-out", "set-2", "2"],
          ];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/1/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/2/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/3/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-2/1/_question",
        "exercises/high-school/snbt/quantitative-knowledge/try-out/set-2/2/_question",
      ]);

      const result = generateContentParams({
        basePath: "exercises",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));

      expect(slugPaths).toContain("high-school");
      expect(slugPaths).toContain("high-school/snbt");
      expect(slugPaths).toContain("high-school/snbt/quantitative-knowledge");
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-1"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-1/1"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-1/2"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-1/3"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-2"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-2/1"
      );
      expect(slugPaths).toContain(
        "high-school/snbt/quantitative-knowledge/try-out/set-2/2"
      );
    });

    it("should generate params for both set pages and specific exercise pages", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["math"]));
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "exercises/math") {
          return [
            ["algebra"],
            ["algebra", "set-1"],
            ["algebra", "set-1", "1"],
            ["algebra", "set-1", "2"],
            ["algebra", "set-1", "3"],
          ];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/algebra/set-1/1/_question",
        "exercises/math/algebra/set-1/1/_answer",
        "exercises/math/algebra/set-1/2/_question",
        "exercises/math/algebra/set-1/2/_answer",
        "exercises/math/algebra/set-1/3/_question",
        "exercises/math/algebra/set-1/3/_answer",
      ]);

      const result = generateContentParams({
        basePath: "exercises",
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));

      expect(slugPaths).toContain("math/algebra/set-1");
      expect(slugPaths).toContain("math/algebra/set-1/1");
      expect(slugPaths).toContain("math/algebra/set-1/2");
      expect(slugPaths).toContain("math/algebra/set-1/3");

      const set1Path = result.find(
        (r) => r.slug.join("/") === "math/algebra/set-1"
      );
      const exercise1Path = result.find(
        (r) => r.slug.join("/") === "math/algebra/set-1/1"
      );
      const exercise2Path = result.find(
        (r) => r.slug.join("/") === "math/algebra/set-1/2"
      );

      expect(set1Path).toBeDefined();
      expect(exercise1Path).toBeDefined();
      expect(exercise2Path).toBeDefined();
    });

    it("should work with subject content structure", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["mathematics", "physics"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "subject/mathematics") {
          return [["algebra"], ["calculus"], ["derivatives"]];
        }
        if (path === "subject/physics") {
          return [["mechanics"]];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "subject/mathematics/calculus/derivatives",
      ]);

      const result = generateContentParams({
        basePath: "subject",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("mathematics");
      expect(slugPaths).toContain("mathematics/algebra");
      expect(slugPaths).toContain("mathematics/calculus");
    });
  });
});

describe("generateAllContentParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should export the function", () => {
      expect(generateAllContentParams).toBeDefined();
    });

    it("should return an array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("localeInSlug option", () => {
    it("should return StaticParamsWithLocale when localeInSlug is false", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({ localeInSlug: false });

      expect(result.length).toBeGreaterThan(0);
      const firstResult = result[0];
      expect(firstResult).toHaveProperty("locale");
      expect(firstResult).toHaveProperty("slug");
    });

    it("should return StaticParamsSlugOnly when localeInSlug is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({ localeInSlug: true });

      expect(result.length).toBeGreaterThan(0);
      const firstResult = result[0];
      expect(firstResult).toHaveProperty("slug");
      expect(firstResult).not.toHaveProperty("locale");
      expect(firstResult.slug[0]).toBe("en");
    });

    it("should include locale as first slug element when localeInSlug is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({ localeInSlug: true });

      const enResults = result.filter((r) => r.slug[0] === "en");
      const idResults = result.filter((r) => r.slug[0] === "id");

      expect(enResults.length).toBeGreaterThan(0);
      expect(idResults.length).toBeGreaterThan(0);
    });
  });

  describe("includeQuran option", () => {
    it("should include quran paths when includeQuran is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeQuran: true,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("quran");
      expect(slugPaths).toContain("quran/1");
      expect(slugPaths).toContain("quran/114");
    });

    it("should generate all 114 surah paths when includeQuran is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeQuran: true,
        locales: ["en"],
      });

      const quranPaths = result.filter(
        (r) => r.slug[0] === "quran" && r.slug.length === 2
      );
      expect(quranPaths).toHaveLength(114);
    });

    it("should not include quran paths when includeQuran is false", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeQuran: false,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).not.toContain("quran");
    });

    it("should include quran paths with locale in slug when both options are true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({
        localeInSlug: true,
        includeQuran: true,
        locales: ["en"],
      });

      expect(result.some((r) => r.slug.join("/") === "en/quran")).toBe(true);
      expect(result.some((r) => r.slug.join("/") === "en/quran/1")).toBe(true);
    });
  });

  describe("includeExerciseSets option", () => {
    it("should include exercise set paths when includeExerciseSets is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
        "exercises/math/set-2/1/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeExerciseSets: true,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("exercises/math/set-1");
      expect(slugPaths).toContain("exercises/math/set-2");
    });

    it("should not include exercise set paths when includeExerciseSets is false", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeExerciseSets: false,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).not.toContain("exercises/math/set-1");
    });
  });

  describe("includeExerciseNumbers option", () => {
    it("should include specific exercise number paths when includeExerciseNumbers is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
        "exercises/math/set-1/2/_question",
        "exercises/math/set-1/3/_answer",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeExerciseNumbers: true,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("exercises/math/set-1/1");
      expect(slugPaths).toContain("exercises/math/set-1/2");
      expect(slugPaths).toContain("exercises/math/set-1/3");
    });

    it("should not include exercise number paths when includeExerciseNumbers is false", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
        "exercises/math/set-1/2/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeExerciseNumbers: false,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).not.toContain("exercises/math/set-1/1");
      expect(slugPaths).not.toContain("exercises/math/set-1/2");
    });

    it("should include both sets and numbers when both options are true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
        "exercises/math/set-1/2/_question",
        "exercises/math/set-2/1/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeExerciseSets: true,
        includeExerciseNumbers: true,
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("exercises/math/set-1");
      expect(slugPaths).toContain("exercises/math/set-2");
      expect(slugPaths).toContain("exercises/math/set-1/1");
      expect(slugPaths).toContain("exercises/math/set-1/2");
      expect(slugPaths).toContain("exercises/math/set-2/1");
    });

    it("should include exercise numbers with locale in slug", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
        "exercises/math/set-1/2/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: true,
        includeExerciseNumbers: true,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("en/exercises/math/set-1/1");
      expect(slugPaths).toContain("en/exercises/math/set-1/2");
    });

    it("should include exercise numbers with OG variants", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/math/set-1/1/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeExerciseNumbers: true,
        includeOGVariants: true,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("exercises/math/set-1/1");
      expect(slugPaths).toContain("exercises/math/set-1/1/image.png");
    });
  });

  describe("includeOGVariants option", () => {
    it("should include image.png variants when includeOGVariants is true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeOGVariants: true,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("image.png");
      expect(slugPaths).toContain("subject/image.png");
    });

    it("should include OG variants with locale in slug when both options are true", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({
        localeInSlug: true,
        includeOGVariants: true,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("en/image.png");
      expect(slugPaths).toContain("en/subject/image.png");
    });

    it("should not include OG variants when includeOGVariants is false", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeOGVariants: false,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).not.toContain("image.png");
      expect(slugPaths).not.toContain("subject/image.png");
    });
  });

  describe("custom locales", () => {
    it("should use custom locales array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({
        localeInSlug: false,
        locales: ["de", "fr"],
      });

      const locales = result.map((r) => r.locale);
      expect(locales).toContain("de");
      expect(locales).toContain("fr");
      expect(locales).not.toContain("en");
      expect(locales).not.toContain("id");
    });

    it("should handle empty locales array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

      const result = generateAllContentParams({
        localeInSlug: false,
        locales: [],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle getFolderChildNames failure gracefully", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.fail(new DirectoryReadError({ path: ".", cause: "test error" }))
      );
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({
        localeInSlug: false,
      });

      expect(result).toHaveLength(0);
    });

    it("should handle empty MDX slugs", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateAllContentParams({
        localeInSlug: false,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("content path filtering", () => {
    it("should only include paths that exist in MDX cache", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject", "articles"])
      );
      vi.mocked(getNestedSlugs).mockImplementation((path) => {
        if (path === "subject") {
          return [["math"], ["physics"]];
        }
        return [];
      });
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "subject",
        "subject/math",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("subject");
      expect(slugPaths).toContain("subject/math");
      expect(slugPaths).not.toContain("subject/physics");
      expect(slugPaths).not.toContain("articles");
    });
  });

  describe("combined options", () => {
    it("should handle all options enabled together", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([["math"]]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "subject",
        "subject/math",
        "exercises/test/set-1/1/_question",
        "exercises/test/set-1/2/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: true,
        includeQuran: true,
        includeExerciseSets: true,
        includeExerciseNumbers: true,
        includeOGVariants: true,
        locales: ["en"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));

      expect(slugPaths).toContain("en/subject");
      expect(slugPaths).toContain("en/subject/image.png");
      expect(slugPaths).toContain("en/quran");
      expect(slugPaths).toContain("en/quran/1");
      expect(slugPaths).toContain("en/exercises/test/set-1");
      expect(slugPaths).toContain("en/exercises/test/set-1/1");
      expect(slugPaths).toContain("en/exercises/test/set-1/2");
      expect(slugPaths).toContain("en/exercises/test/set-1/1/image.png");
      expect(slugPaths).toContain("en/image.png");
    });

    it("should handle localeInSlug false with all other options", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["subject"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "subject",
        "exercises/test/set-1/1/_question",
        "exercises/test/set-1/2/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: false,
        includeQuran: true,
        includeExerciseSets: true,
        includeExerciseNumbers: true,
        includeOGVariants: true,
        locales: ["en"],
      });

      expect(result.some((r) => r.locale === "en")).toBe(true);
      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("subject");
      expect(slugPaths).toContain("quran");
      expect(slugPaths).toContain("exercises/test/set-1");
      expect(slugPaths).toContain("exercises/test/set-1/1");
      expect(slugPaths).toContain("exercises/test/set-1/2");
    });

    it("should generate correct paths for llms.mdx use case", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "exercises/high-school/snbt/math/set-1/1/_question",
        "exercises/high-school/snbt/math/set-1/2/_question",
        "exercises/high-school/snbt/math/set-1/3/_question",
        "exercises/high-school/snbt/math/set-2/1/_question",
      ]);

      const result = generateAllContentParams({
        localeInSlug: true,
        includeQuran: true,
        includeExerciseSets: true,
        includeExerciseNumbers: true,
        locales: ["en", "id"],
      });

      const slugPaths = result.map((r) => r.slug.join("/"));

      expect(slugPaths).toContain("en/exercises/high-school/snbt/math/set-1");
      expect(slugPaths).toContain("en/exercises/high-school/snbt/math/set-2");
      expect(slugPaths).toContain("en/exercises/high-school/snbt/math/set-1/1");
      expect(slugPaths).toContain("en/exercises/high-school/snbt/math/set-1/2");
      expect(slugPaths).toContain("en/exercises/high-school/snbt/math/set-1/3");
      expect(slugPaths).toContain("en/exercises/high-school/snbt/math/set-2/1");
      expect(slugPaths).toContain("id/exercises/high-school/snbt/math/set-1");
      expect(slugPaths).toContain("id/exercises/high-school/snbt/math/set-1/1");
      expect(slugPaths).toContain("en/quran");
      expect(slugPaths).toContain("en/quran/114");
      expect(slugPaths).toContain("id/quran");
    });
  });
});
