import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateStaticParamsForContent } from "@/lib/static-params";

vi.mock("@repo/contents/_lib/cache");
vi.mock("@repo/contents/_lib/fs");
vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    locales: ["en", "id"],
  },
}));

describe("generateStaticParamsForContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should export the function", () => {
      expect(generateStaticParamsForContent).toBeDefined();
    });

    it("should return an array of static params", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should accept a config object with basePath and includeNestedSlugs", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      expect(() => {
        generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should generate params for nested folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["parent"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([["child1"], ["child2"]]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it("should generate params for deeply nested folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["level1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([
        ["level2", "level3", "level4"],
      ]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle empty folder list", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ locale: "en", slug: ["article1"] });
      expect(result[1]).toEqual({ locale: "en", slug: ["nested", "article2"] });
    });

    it("should include MDX slugs that don't match folder paths", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder-with-content"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([
        "articles/article-without-folder",
      ]);

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        locale: "en",
        slug: ["folder-with-content"],
      });
      expect(result[1]).toEqual({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      const enResults = result.filter((r) => r.locale === "en");
      const idResults = result.filter((r) => r.locale === "id");

      expect(enResults).toHaveLength(1);
      expect(idResults).toHaveLength(1);
      expect(enResults[0]).toEqual({ locale: "en", slug: ["en-folder"] });
      expect(idResults[0]).toEqual({ locale: "id", slug: ["id-folder"] });
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
        basePath: "articles",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: "en", slug: ["folder1"] });
      expect(result[1]).toEqual({ locale: "id", slug: ["folder1"] });
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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

      const result = generateStaticParamsForContent({
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
        "exercises/math/algebra/problem1",
        "exercises/math/algebra/problem2",
        "exercises/physics/kinematics",
      ]);

      const result = generateStaticParamsForContent({
        basePath: "exercises",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("math");
      expect(slugPaths).toContain("physics");
      expect(slugPaths).toContain("math/algebra");
      expect(slugPaths).toContain("math/calculus");
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

      const result = generateStaticParamsForContent({
        basePath: "subject",
      });

      const slugPaths = result.map((r) => r.slug.join("/"));
      expect(slugPaths).toContain("mathematics");
      expect(slugPaths).toContain("mathematics/algebra");
      expect(slugPaths).toContain("mathematics/calculus");
    });
  });

  describe("defensive coding documentation", () => {
    it("should handle edge case: defensive fallback for missing locale entries", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateStaticParamsForContent({
        basePath: "articles",

        locales: ["test-locale"],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ locale: "test-locale", slug: ["folder1"] });
    });

    it("should handle empty locales array", () => {
      vi.mocked(getFolderChildNames).mockReturnValue(
        Effect.succeed(["folder1"])
      );
      vi.mocked(getNestedSlugs).mockReturnValue([]);
      vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

      const result = generateStaticParamsForContent({
        basePath: "articles",

        locales: [],
      });

      expect(result).toHaveLength(0);
    });
  });
});
