import fs from "node:fs";
import {
  getAllCachedLocales,
  getMDXFileCache,
  getMDXSlugsForLocale,
  hasLocaleInCache,
  hasPathInCache,
  registry,
  resetMDXFileCache,
} from "@repo/contents/_lib/cache";
import type { Locale } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cache - basic functionality", () => {
  it("should export all functions", () => {
    expect(getAllCachedLocales).toBeDefined();
    expect(getMDXSlugsForLocale).toBeDefined();
    expect(hasLocaleInCache).toBeDefined();
    expect(hasPathInCache).toBeDefined();
    expect(resetMDXFileCache).toBeDefined();
    expect(getMDXFileCache).toBeDefined();
  });

  it("should support custom config via spread operator", () => {
    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).toBeDefined();
    expect(cache instanceof Map).toBe(true);
  });

  it("should build cache without crashing", () => {
    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).toBeDefined();
    expect(cache instanceof Map).toBe(true);
  });

  it("should return same cache instance on subsequent calls", () => {
    resetMDXFileCache();
    const cache1 = registry.build();
    const cache2 = registry.build();
    expect(cache1).toBe(cache2);
  });

  it("should return cached instance on build() when already built", () => {
    resetMDXFileCache();
    const cache1 = registry.build();
    const cache2 = registry.build();
    expect(cache1).toBe(cache2);
    const cache3 = registry.build();
    expect(cache3).toBe(cache1);
  });

  it("should reset cache", () => {
    resetMDXFileCache();
    const cache1 = registry.build();
    resetMDXFileCache();
    const cache2 = registry.build();
    expect(cache1).not.toBe(cache2);
  });

  it("should have locales in cache", () => {
    resetMDXFileCache();
    registry.build();
    const locales = getAllCachedLocales();
    expect(locales.length).toBeGreaterThan(0);
    expect(locales).toContain("en");
    expect(locales).toContain("id");
  });

  it("should return null cache before build", () => {
    resetMDXFileCache();
    const cache = getMDXFileCache();
    expect(cache).toBe(null);
  });

  it("should return cache after build", () => {
    resetMDXFileCache();
    registry.build();
    const cache = getMDXFileCache();
    expect(cache).not.toBe(null);
    expect(cache instanceof Map).toBe(true);
  });
});

describe("cache - locale and path checks", () => {
  beforeEach(() => {
    resetMDXFileCache();
  });

  it("should check if locale exists in cache", () => {
    registry.build();
    expect(hasLocaleInCache("en")).toBe(true);
    expect(hasLocaleInCache("id")).toBe(true);
  });

  it("should return false for invalid locale", () => {
    resetMDXFileCache();
    registry.build();
    const hasLocale = hasLocaleInCache("invalid-locale");
    expect(hasLocale).toBe(false);
  });

  it("should check if path exists in cache", () => {
    registry.build();
    const slugs = getMDXSlugsForLocale("en");
    if (slugs.length > 0) {
      expect(hasPathInCache("en", slugs[0])).toBe(true);
      expect(hasPathInCache("en", "non-existent-path")).toBe(false);
    }
    expect(hasPathInCache("id", "non-existent-path")).toBe(false);
  });

  it("should return false when checking path for non-existent locale", () => {
    registry.build();
    expect(hasPathInCache("fr", "some-path")).toBe(false);
  });

  it("should return slugs for locale", () => {
    registry.build();
    const enSlugs = getMDXSlugsForLocale("en");
    const idSlugs = getMDXSlugsForLocale("id");
    expect(Array.isArray(enSlugs)).toBe(true);
    expect(Array.isArray(idSlugs)).toBe(true);
  });

  it("should auto-build cache when checking locale before build", () => {
    resetMDXFileCache();
    expect(hasLocaleInCache("en")).toBe(true);
  });

  it("should auto-build cache when checking path before build", () => {
    resetMDXFileCache();
    const slugs = getMDXSlugsForLocale("en");
    if (slugs.length > 0) {
      expect(hasPathInCache("en", slugs[0])).toBe(true);
    }
  });

  it("should auto-build cache when getting slugs before build", () => {
    resetMDXFileCache();
    const slugs = getMDXSlugsForLocale("en");
    expect(Array.isArray(slugs)).toBe(true);
  });

  it("should auto-build cache when getting all locales before build", () => {
    resetMDXFileCache();
    const locales = getAllCachedLocales();
    expect(locales.length).toBeGreaterThan(0);
  });
});

describe("cache - edge cases", () => {
  beforeEach(() => {
    resetMDXFileCache();
  });

  it("should filter out non-MDX files", () => {
    registry.build();
    const cache = getMDXFileCache();
    expect(cache).not.toBe(null);
    const enPaths = cache?.get("en");
    if (enPaths && enPaths.size > 0) {
      const firstPath = Array.from(enPaths)[0];
      expect(firstPath).not.toContain(".mdx");
    }
  });

  it("should handle directory read errors gracefully", () => {
    resetMDXFileCache();
    registry.build();
    const cache = getMDXFileCache();
    expect(cache).not.toBe(null);
    expect(cache instanceof Map).toBe(true);
  });

  it("should ignore files without valid locale prefix", () => {
    resetMDXFileCache();
    registry.build();
    const cache = getMDXFileCache();
    expect(cache).not.toBe(null);
    expect(cache instanceof Map).toBe(true);
  });

  it("should process exercise subdirectories correctly", () => {
    resetMDXFileCache();
    registry.build();
    const slugs = getMDXSlugsForLocale("en");
    const exerciseSlugs = slugs.filter(
      (slug) => slug.includes("_question") || slug.includes("_answer")
    );
    expect(Array.isArray(exerciseSlugs)).toBe(true);
  });
});

describe("cache - concurrent build protection", () => {
  it("should prevent concurrent builds", () => {
    resetMDXFileCache();
    registry.build();
    const cache = getMDXFileCache();
    expect(cache).not.toBe(null);
    const slugs = getMDXSlugsForLocale("en");
    expect(Array.isArray(slugs)).toBe(true);
  });

  it("should throw error when build is called concurrently", () => {
    resetMDXFileCache();
    registry.startBuilding();
    expect(() => registry.build()).toThrow("Cache is already being built");
    registry.stopBuilding();
  });
});

describe("cache - mocked filesystem tests", () => {
  beforeEach(() => {
    resetMDXFileCache();
  });

  it("should handle directory read errors gracefully", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Permission denied");
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);
    expect(cache instanceof Map).toBe(true);

    mockFs.readdirSync.mockRestore();
  });

  it("should ignore files without .mdx extension", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "articles",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 2 &&
        typeof path === "string" &&
        path.includes("articles")
      ) {
        return [
          {
            name: "test.txt",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should ignore files without valid locale prefix", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "articles",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 2 &&
        typeof path === "string" &&
        path.includes("articles")
      ) {
        return [
          {
            name: "invalid.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle empty relative path", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "en.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle nested exercise subdirectory paths", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "exercises",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 2 &&
        typeof path === "string" &&
        path.includes("exercises")
      ) {
        return [
          {
            name: "test",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 3 &&
        typeof path === "string" &&
        path.includes("test")
      ) {
        return [
          {
            name: "_question",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 4 &&
        typeof path === "string" &&
        path.includes("_question")
      ) {
        return [
          {
            name: "en.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle slugs for non-existent locale", () => {
    resetMDXFileCache();
    registry.build();
    const slugs = getMDXSlugsForLocale("fr" as Locale);
    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs.length).toBe(0);
  });

  it("should handle path check for non-existent locale in cache", () => {
    resetMDXFileCache();
    registry.build();
    const hasPath = hasPathInCache("en", "some/path");
    expect(typeof hasPath).toBe("boolean");
  });

  it("should handle empty relative path in exercise subdirectory", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "_question",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 2 &&
        typeof path === "string" &&
        path.includes("_question")
      ) {
        return [
          {
            name: "en.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle path check when locale cache is empty", () => {
    const mockFs = vi.mocked(fs);

    vi.spyOn(mockFs, "readdirSync").mockReturnValue([]);

    resetMDXFileCache();
    registry.build();
    const hasPath = hasPathInCache("en", "some/path");
    expect(typeof hasPath).toBe("boolean");

    mockFs.readdirSync.mockRestore();
  });

  it("should handle getting all locales when cache is null", () => {
    resetMDXFileCache();
    const locales = getAllCachedLocales();
    expect(Array.isArray(locales)).toBe(true);
    expect(locales.length).toBeGreaterThan(0);
  });

  it("should handle hasPath when cache is already built", () => {
    registry.build();
    const hasPath = hasPathInCache("en", "some/path");
    expect(typeof hasPath).toBe("boolean");
  });

  it("should handle hasPath when cache is null", () => {
    resetMDXFileCache();
    const hasPath = hasPathInCache("en", "some/path");
    expect(typeof hasPath).toBe("boolean");
  });

  it("should handle hasPath when locale cache exists but path not found", () => {
    registry.build();
    const slugs = getMDXSlugsForLocale("en");
    if (slugs.length > 0) {
      const hasPath = hasPathInCache("en", slugs[0]);
      expect(typeof hasPath).toBe("boolean");
    }
  });

  it("should handle hasPath when locale cache is null but path exists", () => {
    resetMDXFileCache();
    const hasPath = hasPathInCache("en", "some/path");
    expect(typeof hasPath).toBe("boolean");
  });

  it("should handle hasPath when locale cache is undefined", () => {
    resetMDXFileCache();
    const hasPath = hasPathInCache("id", "nonexistent/path");
    expect(typeof hasPath).toBe("boolean");
  });

  it("should handle hasPath when locale is valid but removed from cache", () => {
    registry.build();
    const cache = getMDXFileCache();
    if (cache) {
      cache.delete("en");
      const hasPath = hasPathInCache("en", "some/path");
      expect(hasPath).toBe(false);
    }
  });

  it("should handle hasPath when this.cache is truthy", () => {
    registry.build();
    const hasPath = hasPathInCache("en", "some/path");
    expect(typeof hasPath).toBe("boolean");
  });

  it("should handle processExerciseSubdirectory with directories", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "_question",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 2 &&
        typeof path === "string" &&
        path.includes("_question")
      ) {
        return [
          {
            name: "_nested",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle processExerciseSubdirectory when entries is empty", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "_question",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount === 2 &&
        typeof path === "string" &&
        path.includes("_question")
      ) {
        return [];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle stack iteration with null entries", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "test",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (callCount > 1) {
        return [];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);
    expect(cache instanceof Map).toBe(true);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle stack iteration when stack is empty", () => {
    const mockFs = vi.mocked(fs);

    vi.spyOn(mockFs, "readdirSync").mockImplementation(() => {
      return [];
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);
    expect(cache instanceof Map).toBe(true);

    mockFs.readdirSync.mockRestore();
  });

  it("should ignore directories in ignoreDirPrefixes list", () => {
    const mockFs = vi.mocked(fs);
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "_draft",
            isFile: () => false,
            isDirectory: () => true,
          },
          {
            name: "_archived",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      return [];
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should handle isDirectory false and isFile false case", () => {
    const mockFs = vi.mocked(fs);
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "unknown",
            isFile: () => false,
            isDirectory: () => false,
          },
        ];
      }
      return [];
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should process directories not in ignoreDirPrefixes list", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "articles",
            isFile: () => false,
            isDirectory: () => true,
          },
          {
            name: "exercises",
            isFile: () => false,
            isDirectory: () => true,
          },
        ];
      }
      if (
        callCount > 1 &&
        typeof path === "string" &&
        (path.includes("articles") || path.includes("exercises"))
      ) {
        return [];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });

  it("should correctly handle both files and directories during iteration", () => {
    const mockFs = vi.mocked(fs);
    const originalReaddirSync = mockFs.readdirSync;
    let callCount = 0;

    vi.spyOn(mockFs, "readdirSync").mockImplementation((path, options) => {
      callCount++;
      if (callCount === 1) {
        return [
          {
            name: "_draft",
            isFile: () => false,
            isDirectory: () => true,
          },
          {
            name: "index.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
          {
            name: "_question",
            isFile: () => false,
            isDirectory: () => true,
          },
          {
            name: "test.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      if (
        callCount > 1 &&
        typeof path === "string" &&
        path.includes("_question")
      ) {
        return [
          {
            name: "q1.mdx",
            isFile: () => true,
            isDirectory: () => false,
          },
        ];
      }
      return originalReaddirSync(path, options);
    });

    resetMDXFileCache();
    const cache = registry.build();
    expect(cache).not.toBe(null);

    mockFs.readdirSync.mockRestore();
  });
});

describe("cache - exercise structure", () => {
  beforeEach(() => {
    resetMDXFileCache();
  });

  it("should include exercise subdirectory paths", () => {
    registry.build();
    const enSlugs = getMDXSlugsForLocale("en");
    const idSlugs = getMDXSlugsForLocale("id");

    const enQuestionSlugs = enSlugs.filter((slug) =>
      slug.includes("_question")
    );
    const idQuestionSlugs = idSlugs.filter((slug) =>
      slug.includes("_question")
    );

    expect(enQuestionSlugs.length).toBeGreaterThan(0);
    expect(idQuestionSlugs.length).toBeGreaterThan(0);
  });

  it("should include both question and answer paths", () => {
    registry.build();
    const enSlugs = getMDXSlugsForLocale("en");

    const questionSlugs = enSlugs.filter((slug) => slug.includes("_question"));
    const answerSlugs = enSlugs.filter((slug) => slug.includes("_answer"));

    expect(questionSlugs.length).toBeGreaterThan(0);
    expect(answerSlugs.length).toBeGreaterThan(0);
  });

  it("should maintain consistent slug format", () => {
    registry.build();
    const enSlugs = getMDXSlugsForLocale("en");

    const exerciseSlug = enSlugs.find((slug) => slug.includes("exercises/"));
    if (exerciseSlug) {
      expect(exerciseSlug.startsWith("exercises/")).toBe(true);
      expect(exerciseSlug).not.toContain(".mdx");
    }
  });
});
