import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import {
  generateContentParams,
  generateLocaleParams,
  generateSlugOnlyParams,
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
});

describe("generateContentParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      Effect.fail(new DirectoryReadError({ path: "test", cause: "error" }))
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
});

describe("generateSlugOnlyParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should work when called without arguments", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateSlugOnlyParams();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return params with locale in slug", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateSlugOnlyParams({});

    expect(result[0]).toHaveProperty("slug");
    expect(result[0]).not.toHaveProperty("locale");
    expect(result[0].slug[0]).toBe("en");
  });

  it("should include quran paths when includeQuran is true", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateSlugOnlyParams({
      includeQuran: true,
      locales: ["en"],
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/quran");
    expect(slugPaths).toContain("en/quran/1");
    expect(slugPaths).toContain("en/quran/114");
  });

  it("should generate all 114 surah paths", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateSlugOnlyParams({
      includeQuran: true,
      locales: ["en"],
    });
    const surahPaths = result.filter(
      (r) => r.slug[1] === "quran" && r.slug.length === 3
    );

    expect(surahPaths).toHaveLength(114);
  });

  it("should include exercise sets when includeExerciseSets is true", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "exercises/math/set-1/1/_question",
    ]);

    const result = generateSlugOnlyParams({
      includeExerciseSets: true,
      locales: ["en"],
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/exercises/math/set-1");
  });

  it("should include exercise numbers when includeExerciseNumbers is true", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed([]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/2/_question",
    ]);

    const result = generateSlugOnlyParams({
      includeExerciseNumbers: true,
      locales: ["en"],
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/exercises/math/set-1/1");
    expect(slugPaths).toContain("en/exercises/math/set-1/2");
  });

  it("should include OG variants when includeOGVariants is true", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateSlugOnlyParams({
      includeOGVariants: true,
      locales: ["en"],
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/image.png");
    expect(slugPaths).toContain("en/subject/image.png");
  });

  it("should handle all options together (llms.mdx use case)", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "exercises/math/set-1/1/_question",
      "exercises/math/set-1/2/_question",
    ]);

    const result = generateSlugOnlyParams({
      includeQuran: true,
      includeExerciseSets: true,
      includeExerciseNumbers: true,
      locales: ["en"],
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/subject");
    expect(slugPaths).toContain("en/quran");
    expect(slugPaths).toContain("en/quran/1");
    expect(slugPaths).toContain("en/exercises/math/set-1");
    expect(slugPaths).toContain("en/exercises/math/set-1/1");
    expect(slugPaths).toContain("en/exercises/math/set-1/2");
  });

  it("should include top-level dir when in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.succeed(["subject", "articles"])
    );
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateSlugOnlyParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/subject");
    expect(slugPaths).not.toContain("en/articles");
  });

  it("should skip top-level dir when not in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.succeed(["subject", "articles"])
    );
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateSlugOnlyParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).not.toContain("en/subject");
    expect(slugPaths).not.toContain("en/articles");
  });

  it("should include nested paths that exist in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["math"], ["math", "algebra"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "subject/math",
      "subject/math/algebra",
    ]);

    const result = generateSlugOnlyParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/subject");
    expect(slugPaths).toContain("en/subject/math");
    expect(slugPaths).toContain("en/subject/math/algebra");
  });

  it("should skip nested paths not in MDX cache", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["math"], ["physics"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "subject/math",
    ]);

    const result = generateSlugOnlyParams({ locales: ["en"] });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("en/subject");
    expect(slugPaths).toContain("en/subject/math");
    expect(slugPaths).not.toContain("en/subject/physics");
  });

  it("should handle multiple locales", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateSlugOnlyParams({ locales: ["en", "id"] });

    const enResults = result.filter((r) => r.slug[0] === "en");
    const idResults = result.filter((r) => r.slug[0] === "id");

    expect(enResults.length).toBeGreaterThan(0);
    expect(idResults.length).toBeGreaterThan(0);
  });

  it("should handle error gracefully", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.fail(new DirectoryReadError({ path: ".", cause: "error" }))
    );
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([]);

    const result = generateSlugOnlyParams({});
    expect(result).toHaveLength(0);
  });

  it("should handle empty locales array", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateSlugOnlyParams({ locales: [] });
    expect(result).toHaveLength(0);
  });
});

describe("generateLocaleParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("should include OG variants when includeOGVariants is true", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue(["subject"]);

    const result = generateLocaleParams({
      includeOGVariants: true,
      locales: ["en"],
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("image.png");
    expect(slugPaths).toContain("subject/image.png");
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

    const result = generateLocaleParams({ locales: ["de", "fr"] });

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

  it("should include nested paths with OG variants", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(Effect.succeed(["subject"]));
    vi.mocked(getNestedSlugs).mockReturnValue([["math"]]);
    vi.mocked(getMDXSlugsForLocale).mockReturnValue([
      "subject",
      "subject/math",
    ]);

    const result = generateLocaleParams({
      locales: ["en"],
      includeOGVariants: true,
    });
    const slugPaths = result.map((r) => r.slug.join("/"));

    expect(slugPaths).toContain("subject");
    expect(slugPaths).toContain("subject/image.png");
    expect(slugPaths).toContain("subject/math");
    expect(slugPaths).toContain("subject/math/image.png");
  });

  it("should handle error gracefully", () => {
    vi.mocked(getFolderChildNames).mockReturnValue(
      Effect.fail(new DirectoryReadError({ path: ".", cause: "error" }))
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
});
