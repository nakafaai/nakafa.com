import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
  getNestedSlugs,
} from "@repo/contents/_lib/fs";
import {
  generateContentParams,
  generateLocaleParams,
  getExerciseNumberPaths,
  getExerciseSetPaths,
  resetStaticParamCaches,
} from "@repo/contents/_lib/params";
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

let folderCacheVersion = 0;

beforeEach(() => {
  folderCacheVersion = 0;
  resetStaticParamCaches();
  vi.clearAllMocks();
  vi.mocked(getFolderChildNamesCacheVersion).mockImplementation(
    () => folderCacheVersion
  );
});

describe("getExerciseSetPaths", () => {
  it("should extract exercise set paths", () => {
    const slugs = [
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/2/_question",
      "exercises/math/set-2/1/_question",
    ];
    const result = getExerciseSetPaths(slugs);
    expect(result).toContain("exercises/math/set-1");
    expect(result).toContain("exercises/math/set-2");
  });

  it("should return empty array for empty input", () => {
    expect(getExerciseSetPaths([])).toEqual([]);
  });

  it("should deduplicate paths", () => {
    const slugs = [
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/1/_answer",
      "exercises/math/set-1/2/_question",
    ];
    const result = getExerciseSetPaths(slugs);
    expect(result).toEqual(["exercises/math/set-1"]);
  });

  it("should not match non-exercise paths", () => {
    const slugs = ["articles/my-article", "subject/math/algebra"];
    const result = getExerciseSetPaths(slugs);
    expect(result).toEqual([]);
  });
});

describe("getExerciseNumberPaths", () => {
  it("should extract exercise number paths", () => {
    const slugs = [
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/2/_question",
    ];
    const result = getExerciseNumberPaths(slugs);
    expect(result).toContain("exercises/math/set-1/1");
    expect(result).toContain("exercises/math/set-1/2");
  });

  it("should return empty array for empty input", () => {
    expect(getExerciseNumberPaths([])).toEqual([]);
  });

  it("should deduplicate paths", () => {
    const slugs = [
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/1/_answer",
    ];
    const result = getExerciseNumberPaths(slugs);
    expect(result).toEqual(["exercises/math/set-1/1"]);
  });

  it("should handle multi-digit exercise numbers", () => {
    const slugs = [
      "exercises/math/set-1/10/_question",
      "exercises/math/set-1/99/_question",
    ];
    const result = getExerciseNumberPaths(slugs);
    expect(result).toContain("exercises/math/set-1/10");
    expect(result).toContain("exercises/math/set-1/99");
  });

  it("should not match non-exercise paths", () => {
    const slugs = ["articles/my-article", "subject/math/algebra"];
    const result = getExerciseNumberPaths(slugs);
    expect(result).toEqual([]);
  });
});

describe("generateContentParams", () => {
  it("should generate params with locale as separate param", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["folder"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateContentParams({ basePath: "articles" });

    expect(result[0]).toHaveProperty("locale");
    expect(result[0]).toHaveProperty("slug");
    expect(result[0].locale).toBe("en");
  });

  it("should include exercise set paths for exercises basePath", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["math"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "exercises/math/set-1/1/_question",
    ]);

    const result = generateContentParams({ basePath: "exercises" });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("math/set-1");
  });

  it("should handle custom locales", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["folder"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateContentParams({
      basePath: "articles",
      locales: ["de", "fr"],
    });

    const locales = result.map((r) => r.locale);
    expect(locales).toContain("de");
    expect(locales).toContain("fr");
    expect(locales).not.toContain("en");
  });

  it("should include MDX paths not in folder paths", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["folder1"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "articles/folder1",
      "articles/mdx-only-path",
      "articles/another-mdx-path",
    ]);

    const result = generateContentParams({
      basePath: "articles",
      locales: ["en"],
    });

    const slugPaths = result.map((r) => r.slug.join("/"));
    expect(slugPaths).toContain("folder1");
    expect(slugPaths).toContain("mdx-only-path");
    expect(slugPaths).toContain("another-mdx-path");
  });

  it("should include exercise set paths not in folder paths for exercises basePath", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["math"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "exercises/math/algebra/set-1/1/_question",
      "exercises/math/algebra/set-2/1/_question",
    ]);

    const result = generateContentParams({
      basePath: "exercises",
      locales: ["en"],
    });

    const slugPaths = result.map((r) => r.slug.join("/"));
    expect(slugPaths).toContain("math");
    expect(slugPaths).toContain("math/algebra/set-1");
    expect(slugPaths).toContain("math/algebra/set-2");
  });

  it("should not duplicate exercise set paths that match folder paths", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["math"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["algebra", "set-1"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "exercises/math/algebra/set-1/1/_question",
    ]);

    const result = generateContentParams({
      basePath: "exercises",
      locales: ["en"],
    });

    const slugPaths = result.map((r) => r.slug.join("/"));
    const set1Count = slugPaths.filter(
      (p) => p === "math/algebra/set-1"
    ).length;
    expect(set1Count).toBe(1);
  });

  it("should include nested folder paths", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["parent"]));
    vi.mocked(getNestedSlugs).mockReturnValue([
      ["child"],
      ["child", "grandchild"],
    ]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateContentParams({
      basePath: "articles",
      locales: ["en"],
    });

    const slugPaths = result.map((r) => r.slug.join("/"));
    expect(slugPaths).toContain("parent");
    expect(slugPaths).toContain("parent/child");
    expect(slugPaths).toContain("parent/child/grandchild");
  });

  it("should handle error gracefully", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.fail(
        new DirectoryReadError({
          cause: "error",
          message: "Unable to read test directory.",
          path: "test",
        })
      )
    );
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateContentParams({ basePath: "articles" });
    expect(result).toHaveLength(0);
  });

  it("should handle empty locales array", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["folder"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateContentParams({
      basePath: "articles",
      locales: [],
    });

    expect(result).toHaveLength(0);
  });

  it("reuses folder discovery for repeated base paths", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["folder"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    generateContentParams({ basePath: "articles", locales: ["en"] });
    generateContentParams({ basePath: "articles", locales: ["id"] });

    expect(getFolderChildNames).toHaveBeenCalledTimes(1);
    expect(getNestedSlugs).toHaveBeenCalledTimes(1);
  });

  it("refreshes folder discovery after folder cache invalidation", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["old"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const firstResult = generateContentParams({
      basePath: "articles",
      locales: ["en"],
    });

    folderCacheVersion += 1;
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["new"]));

    const secondResult = generateContentParams({
      basePath: "articles",
      locales: ["en"],
    });

    expect(firstResult).toContainEqual({ locale: "en", slug: ["old"] });
    expect(secondResult).toContainEqual({ locale: "en", slug: ["new"] });
    expect(secondResult).not.toContainEqual({ locale: "en", slug: ["old"] });
    expect(getFolderChildNames).toHaveBeenCalledTimes(2);
  });
});

describe("generateLocaleParams", () => {
  it("should work when called without arguments", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return params with locale as separate param", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams({});

    expect(result[0]).toHaveProperty("locale");
    expect(result[0]).toHaveProperty("slug");
    expect(result[0].locale).toBe("en");
  });

  it("should handle multiple locales", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams({});

    const enResults = result.filter((r) => r.locale === "en");
    const idResults = result.filter((r) => r.locale === "id");

    expect(enResults.length).toBeGreaterThan(0);
    expect(idResults.length).toBeGreaterThan(0);
  });

  it("should handle custom locales", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams({
      locales: ["de", "fr"],
    });

    const locales = result.map((r) => r.locale);
    expect(locales).toContain("de");
    expect(locales).toContain("fr");
    expect(locales).not.toContain("en");
  });

  it("should include top-level dir when in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.succeed(["subject", "articles"])
    );
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("subject");
    expect(slugPaths).not.toContain("articles");
  });

  it("should skip top-level dir when not in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.succeed(["subject", "articles"])
    );
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateLocaleParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).not.toContain("subject");
    expect(slugPaths).not.toContain("articles");
  });

  it("should include nested paths that exist in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["math"], ["math", "calculus"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "subject/math",
      "subject/math/calculus",
    ]);

    const result = generateLocaleParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("subject");
    expect(slugPaths).toContain("subject/math");
    expect(slugPaths).toContain("subject/math/calculus");
  });

  it("should skip nested paths not in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["math"], ["biology"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "subject/math",
    ]);

    const result = generateLocaleParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("subject");
    expect(slugPaths).toContain("subject/math");
    expect(slugPaths).not.toContain("subject/biology");
  });

  it("should handle error gracefully", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.fail(
        new DirectoryReadError({
          cause: "error",
          message: "Unable to read test directory.",
          path: ".",
        })
      )
    );
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateLocaleParams({});
    expect(result).toHaveLength(0);
  });

  it("should handle empty locales array", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams({ locales: [] });
    expect(result).toHaveLength(0);
  });

  it("reuses nested path discovery across locales", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.succeed(["subject", "articles"])
    );
    vi.mocked(getNestedSlugs)
      .mockReturnValueOnce([["math"]])
      .mockReturnValueOnce([["politics"]]);
    vi.mocked(getMDXSlugsForLocale).mockImplementation((locale) =>
      locale === "en"
        ? ["subject", "subject/math", "articles/politics"]
        : ["subject", "articles/politics"]
    );

    const result = generateLocaleParams({ locales: ["en", "id"] });

    expect(getNestedSlugs).toHaveBeenCalledTimes(2);
    expect(result).toContainEqual({ locale: "en", slug: ["subject", "math"] });
    expect(result).toContainEqual({
      locale: "id",
      slug: ["articles", "politics"],
    });
  });

  it("reuses content path discovery across repeated calls", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["math"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "subject/math",
    ]);

    generateLocaleParams({ locales: ["en"] });
    generateLocaleParams({ locales: ["en"] });

    expect(getFolderChildNames).toHaveBeenCalledTimes(1);
    expect(getNestedSlugs).toHaveBeenCalledTimes(1);
  });

  it("refreshes content path discovery after folder cache invalidation", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const firstResult = generateLocaleParams({ locales: ["en"] });

    folderCacheVersion += 1;
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.succeed(["articles"])
    );
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["articles"]);

    const secondResult = generateLocaleParams({ locales: ["en"] });

    expect(firstResult).toContainEqual({ locale: "en", slug: ["subject"] });
    expect(secondResult).toContainEqual({ locale: "en", slug: ["articles"] });
    expect(secondResult).not.toContainEqual({
      locale: "en",
      slug: ["subject"],
    });
    expect(getFolderChildNames).toHaveBeenCalledTimes(2);
  });
});
