import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMetadataFromSlug, getStaticParams } from "../system";

const { mockGetFolderChildNames, mockGetNestedSlugs, mockGetContentMetadata } =
  vi.hoisted(() => ({
    mockGetFolderChildNames: vi.fn(),
    mockGetNestedSlugs: vi.fn(),
    mockGetContentMetadata: vi.fn(),
  }));

vi.mock("@repo/contents/_lib/fs", () => ({
  getFolderChildNames: mockGetFolderChildNames,
  getNestedSlugs: mockGetNestedSlugs,
}));

vi.mock("@repo/contents/_lib/content", () => ({
  getContentMetadata: mockGetContentMetadata,
}));

vi.mock("next-intl/server", () => {
  return {
    getTranslations: vi.fn((params) => {
      const createTranslator = (key: string) => key;
      const translator = Object.assign(createTranslator, {
        rich: createTranslator,
        markup: createTranslator,
        raw: createTranslator,
        has: () => false,
      });

      if (params.namespace === "Common") {
        const commonTranslator = (key: string) => {
          if (key === "made-with-love") {
            return "Made with Love";
          }
          return key;
        };
        return Promise.resolve(
          Object.assign(commonTranslator, {
            rich: commonTranslator,
            markup: commonTranslator,
            raw: commonTranslator,
            has: () => false,
          })
        );
      }
      if (params.namespace === "Metadata") {
        const metadataTranslator = (key: string) => {
          if (key === "short-description") {
            return "Short description";
          }
          return key;
        };
        return Promise.resolve(
          Object.assign(metadataTranslator, {
            rich: metadataTranslator,
            markup: metadataTranslator,
            raw: metadataTranslator,
            has: () => false,
          })
        );
      }
      return Promise.resolve(translator);
    }),
  };
});

beforeEach(() => {
  mockGetFolderChildNames.mockReturnValue(Effect.succeed([]));
  mockGetNestedSlugs.mockReturnValue([]);
  mockGetContentMetadata.mockReturnValue(Effect.succeed(null));
});

afterEach(() => {
  vi.clearAllMocks();
  mockGetFolderChildNames.mockReset();
  mockGetNestedSlugs.mockReset();
  mockGetContentMetadata.mockReset();
});

describe("getStaticParams", () => {
  describe("empty paramNames", () => {
    it("returns empty array for no params", () => {
      const result = getStaticParams({
        basePath: "articles",
        paramNames: [],
      });
      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns empty array when getFolderChildNames fails for basePath", () => {
      mockGetFolderChildNames.mockReturnValue(
        Effect.fail(new Error("Failed to read"))
      );

      const result = getStaticParams({
        basePath: "articles",
        paramNames: ["category"],
      });

      expect(result).toEqual([]);
    });

    it("returns empty array when getFolderChildNames fails for nested path", () => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "articles") {
          return Effect.succeed(["politics"]);
        }
        return Effect.fail(new Error("Failed to read nested"));
      });

      const result = getStaticParams({
        basePath: "articles",
        paramNames: ["category", "slug"],
      });

      expect(result).toEqual([]);
    });
  });

  describe("production: articles structure", () => {
    beforeEach(() => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "articles") {
          return Effect.succeed(["politics", "economy"]);
        }
        if (path === "articles/politics") {
          return Effect.succeed([
            "nepotism-in-political-governance",
            "flawed-legal-geopolitics",
            "kim-plus-empty-box",
            "merah-putih-cabinet-analysis",
          ]);
        }
        if (path === "articles/economy") {
          return Effect.succeed(["inflation", "deflation"]);
        }
        return Effect.succeed([]);
      });
    });

    it("generates article params matching production structure", () => {
      const result = getStaticParams({
        basePath: "articles",
        paramNames: ["category", "slug"],
      });

      expect(result).toContainEqual({
        category: "politics",
        slug: "nepotism-in-political-governance",
      });

      expect(result).toContainEqual({
        category: "politics",
        slug: "flawed-legal-geopolitics",
      });

      expect(result).toContainEqual({
        category: "politics",
        slug: "kim-plus-empty-box",
      });

      expect(result).toContainEqual({
        category: "politics",
        slug: "merah-putih-cabinet-analysis",
      });

      expect(result).toContainEqual({
        category: "economy",
        slug: "inflation",
      });

      expect(result).toContainEqual({
        category: "economy",
        slug: "deflation",
      });

      expect(result.length).toBe(6);
    });
  });

  describe("production: exercises structure (high-school/tka)", () => {
    beforeEach(() => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "exercises") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "exercises/high-school") {
          return Effect.succeed(["tka"]);
        }
        if (path === "exercises/high-school/tka") {
          return Effect.succeed(["mathematics"]);
        }
        if (path === "exercises/high-school/tka/mathematics") {
          return Effect.succeed(["try-out"]);
        }
        return Effect.succeed([]);
      });

      mockGetNestedSlugs.mockImplementation((path: string) => {
        if (path === "exercises/high-school/tka/mathematics/try-out") {
          const paths: string[][] = [];
          for (let set = 1; set <= 3; set++) {
            paths.push([`set-${set}`]);
            for (let item = 1; item <= 40; item++) {
              paths.push([`set-${set}`, String(item)]);
            }
          }
          return paths;
        }
        return [];
      });
    });

    it("generates exercise params matching production structure", () => {
      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      const tkaMathSet1 = result.filter(
        (r) =>
          r.category === "high-school" &&
          r.type === "tka" &&
          r.material === "mathematics" &&
          r.slug[1] === "set-1"
      );

      expect(tkaMathSet1.length).toBeGreaterThan(0);

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-1"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-1", "1"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-1", "40"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-2"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-3"],
      });
    });

    it("generates all 120 exercise items across 3 sets", () => {
      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      const tkaMathExercises = result.filter(
        (r) =>
          r.category === "high-school" &&
          r.type === "tka" &&
          r.material === "mathematics" &&
          r.slug.length === 3
      );

      expect(tkaMathExercises.length).toBe(120);
    });
  });

  describe("production: exercises structure (high-school/snbt)", () => {
    beforeEach(() => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "exercises") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "exercises/high-school") {
          return Effect.succeed(["snbt"]);
        }
        if (path === "exercises/high-school/snbt") {
          return Effect.succeed([
            "english-language",
            "general-knowledge",
            "general-reasoning",
            "indonesian-language",
            "mathematical-reasoning",
            "quantitative-knowledge",
            "reading-and-writing-skills",
          ]);
        }
        return Effect.succeed([]);
      });
    });

    it("generates SNBT exercise params matching production structure", () => {
      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "english-language",
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "general-knowledge",
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "general-reasoning",
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "indonesian-language",
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "snbt",
        material: "reading-and-writing-skills",
      });

      expect(result.length).toBe(7);
    });
  });

  describe("production: subject structure (high-school/10)", () => {
    beforeEach(() => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "subject") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "subject/high-school") {
          return Effect.succeed(["10"]);
        }
        if (path === "subject/high-school/10") {
          return Effect.succeed([
            "biology",
            "chemistry",
            "history",
            "mathematics",
          ]);
        }
        if (path === "subject/high-school/10/mathematics") {
          return Effect.succeed([
            "exponential-logarithm",
            "linear-equation-inequality",
            "probability",
            "quadratic-function",
            "sequence-series",
            "statistics",
            "trigonometry",
            "vector-operations",
          ]);
        }
        if (path === "subject/high-school/10/biology") {
          return Effect.succeed(["cell-biology", "genetics"]);
        }
        if (path === "subject/high-school/10/chemistry") {
          return Effect.succeed(["atomic-structure", "chemical-bonding"]);
        }
        if (path === "subject/high-school/10/history") {
          return Effect.succeed(["indonesian-history", "world-history"]);
        }
        return Effect.succeed([]);
      });

      mockGetNestedSlugs.mockImplementation((path: string) => {
        if (
          path === "subject/high-school/10/mathematics/exponential-logarithm"
        ) {
          return [
            ["basic-concept"],
            ["exponential-decay"],
            ["exponential-growth"],
            ["function-definition"],
            ["function-exploration"],
            ["logarithm-definition"],
            ["logarithm-properties"],
            ["proof-properties"],
            ["properties"],
            ["radical-form"],
            ["rationalizing-radicals"],
          ];
        }
        if (
          path ===
          "subject/high-school/10/mathematics/linear-equation-inequality"
        ) {
          return [["system-linear-equation"], ["system-linear-inequality"]];
        }
        if (path === "subject/high-school/10/mathematics/probability") {
          return [
            ["addition-rule"],
            ["probability-distribution"],
            ["two-events-mutually-exclusive"],
            ["two-events-not-mutually-exclusive"],
          ];
        }
        if (path === "subject/high-school/10/mathematics/quadratic-function") {
          return [
            ["quadratic-equation"],
            ["quadratic-equation-factorization"],
            ["quadratic-equation-formula"],
            ["quadratic-equation-imaginary-root"],
            ["quadratic-equation-perfect-square"],
            ["quadratic-equation-types-of-root"],
            ["quadratic-function-characteristics"],
            ["quadratic-function-construction"],
            ["quadratic-function-maximum-area"],
            ["quadratic-function-minimum-area"],
          ];
        }
        if (path === "subject/high-school/10/mathematics/sequence-series") {
          return [
            ["arithmetic-sequence"],
            ["arithmetic-series"],
            ["convergence-divergence"],
            ["difference-sequence-series"],
            ["geometric-sequence"],
            ["geometric-series"],
            ["infinite-geometric-series"],
            ["sequence-concept"],
            ["series-concept"],
          ];
        }
        if (path === "subject/high-school/10/mathematics/statistics") {
          return [
            ["central-tendency-usage"],
            ["histogram"],
            ["interquartile-range"],
            ["mean"],
            ["mean-group-data"],
            ["median-mode-group-data"],
            ["mode-median"],
            ["percentile-data-group"],
            ["quartile-data-group"],
            ["quartile-data-single"],
            ["relative-frequency"],
            ["variance-standard-deviation-data-group"],
            ["variance-standard-deviation-data-single"],
          ];
        }
        if (path === "subject/high-school/10/mathematics/trigonometry") {
          return [
            ["right-triangle-naming"],
            ["trigonometric-comparison-sin-cos"],
            ["trigonometric-comparison-special-angle"],
            ["trigonometric-comparison-tan"],
            ["trigonometric-comparison-tan-usage"],
            ["trigonometric-comparison-three-primary"],
            ["trigonometry-concept"],
          ];
        }
        if (path === "subject/high-school/10/mathematics/vector-operations") {
          return [
            ["column-row-vector"],
            ["equivalent-vector"],
            ["opposite-vector"],
            ["position-vector"],
            ["scalar-multiplication"],
            ["three-dimensional-vector"],
            ["two-dimensional-vector"],
            ["unit-vector"],
            ["vector-addition"],
            ["vector-components"],
            ["vector-concept"],
            ["vector-coordinate-system"],
            ["vector-subtraction"],
            ["vector-types"],
            ["zero-vector"],
          ];
        }
        if (path === "subject/high-school/10/biology/cell-biology") {
          return [["cell-structure"], ["cell-division"]];
        }
        if (path === "subject/high-school/10/chemistry/atomic-structure") {
          return [["atoms"], ["electrons"], ["protons"]];
        }
        return [];
      });
    });

    it("generates subject params matching production structure", () => {
      const result = getStaticParams({
        basePath: "subject",
        paramNames: ["category", "grade", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      expect(result).toContainEqual({
        category: "high-school",
        grade: "10",
        material: "mathematics",
        slug: ["exponential-logarithm"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        grade: "10",
        material: "mathematics",
        slug: ["exponential-logarithm", "basic-concept"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        grade: "10",
        material: "biology",
        slug: ["cell-biology"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        grade: "10",
        material: "chemistry",
        slug: ["atomic-structure"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        grade: "10",
        material: "history",
        slug: ["indonesian-history"],
      });
    });

    it("generates all mathematics topics for grade 10", () => {
      const result = getStaticParams({
        basePath: "subject",
        paramNames: ["category", "grade", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      const mathTopics = result.filter(
        (r) =>
          r.category === "high-school" &&
          r.grade === "10" &&
          r.material === "mathematics" &&
          r.slug.length === 1
      );

      expect(mathTopics.length).toBe(8);
    });

    it("generates all exponential-logarithm subtopics", () => {
      const result = getStaticParams({
        basePath: "subject",
        paramNames: ["category", "grade", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      const expLogSubtopics = result.filter(
        (r) =>
          r.category === "high-school" &&
          r.grade === "10" &&
          r.material === "mathematics" &&
          r.slug[0] === "exponential-logarithm" &&
          r.slug.length === 2
      );

      expect(expLogSubtopics.length).toBe(11);
    });
  });

  describe("production edge cases", () => {
    it("handles exercises with deep nesting (5 levels)", () => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "exercises") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "exercises/high-school") {
          return Effect.succeed(["tka"]);
        }
        if (path === "exercises/high-school/tka") {
          return Effect.succeed(["mathematics"]);
        }
        if (path === "exercises/high-school/tka/mathematics") {
          return Effect.succeed(["try-out"]);
        }
        return Effect.succeed([]);
      });

      mockGetNestedSlugs.mockReturnValue([
        ["set-1", "advanced", "section-1", "chapter-1", "lesson-1"],
      ]);

      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      const deepPath = result.find(
        (r) => r.slug.length === 6 && r.slug[5] === "lesson-1"
      );

      expect(deepPath).toBeDefined();
      expect(deepPath).toEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: [
          "try-out",
          "set-1",
          "advanced",
          "section-1",
          "chapter-1",
          "lesson-1",
        ],
      });
    });

    it("handles mixed empty and non-empty nested paths", () => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "exercises") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "exercises/high-school") {
          return Effect.succeed(["tka"]);
        }
        if (path === "exercises/high-school/tka") {
          return Effect.succeed(["mathematics", "physics"]);
        }
        if (path === "exercises/high-school/tka/mathematics") {
          return Effect.succeed(["try-out"]);
        }
        if (path === "exercises/high-school/tka/physics") {
          return Effect.succeed(["practice"]);
        }
        return Effect.succeed([]);
      });

      mockGetNestedSlugs.mockImplementation((path: string) => {
        if (path === "exercises/high-school/tka/mathematics/try-out") {
          return [["set-1"], ["set-1", "1"]];
        }
        return [];
      });

      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-1"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "mathematics",
        slug: ["try-out", "set-1", "1"],
      });

      expect(result).toContainEqual({
        category: "high-school",
        type: "tka",
        material: "physics",
        slug: ["practice"],
      });
    });

    it("handles very wide branching (many materials)", () => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "exercises") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "exercises/high-school") {
          return Effect.succeed(["snbt"]);
        }
        if (path === "exercises/high-school/snbt") {
          return Effect.succeed(
            Array.from({ length: 20 }, (_, i) => `subject-${i}`)
          );
        }
        return Effect.succeed([]);
      });

      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material"],
      });

      expect(result.length).toBe(20);
      expect(result[0]).toEqual({
        category: "high-school",
        type: "snbt",
        material: "subject-0",
      });
    });

    it("handles large number of exercise items (50 items per set)", () => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "exercises") {
          return Effect.succeed(["high-school"]);
        }
        if (path === "exercises/high-school") {
          return Effect.succeed(["tka"]);
        }
        if (path === "exercises/high-school/tka") {
          return Effect.succeed(["mathematics"]);
        }
        if (path === "exercises/high-school/tka/mathematics") {
          return Effect.succeed(["practice"]);
        }
        return Effect.succeed([]);
      });

      const manyItems = Array.from({ length: 50 }, (_, i) => [
        `set-${i}`,
        String(i + 1),
      ]);
      mockGetNestedSlugs.mockReturnValue(manyItems);

      const result = getStaticParams({
        basePath: "exercises",
        paramNames: ["category", "type", "material", "slug"],
        slugParam: "slug",
        isDeep: true,
      });

      const practiceItems = result.filter(
        (r) =>
          r.category === "high-school" &&
          r.type === "tka" &&
          r.material === "mathematics" &&
          r.slug.length === 3
      );

      expect(practiceItems.length).toBe(50);
    });
  });
});

describe("getMetadataFromSlug", () => {
  describe("valid content with metadata", () => {
    it("returns metadata from content", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.succeed({
          title: "Test Title",
          description: "Test Description",
          authors: [{ name: "Author" }],
          date: "01/01/2024",
        })
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", ["articles", "politics", "test"])
      );

      expect(result).toEqual({
        title: "Test Title",
        description: "Test Description",
        authors: [{ name: "Author" }],
        date: "01/01/2024",
      });
    });

    it("returns default metadata when content not found", async () => {
      mockGetContentMetadata.mockReturnValue(Effect.succeed(null));

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", ["articles", "politics", "test"])
      );

      expect(result).toEqual({
        title: "Made with Love",
        description: "Short description",
        authors: [{ name: "Nakafa" }],
        date: "",
      });
    });
  });

  describe("production: real MDX date formats", () => {
    it("handles MM/DD/YYYY date format from production MDX", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.succeed({
          title: "Exponential and Logarithmic Functions",
          description: "Learn about exponential and logarithmic functions",
          authors: [{ name: "Nakafa Team" }],
          date: "04/01/2025",
        })
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", [
          "subject",
          "high-school",
          "10",
          "mathematics",
          "exponential-logarithm",
          "basic-concept",
        ])
      );

      expect(result.date).toBe("04/01/2025");
    });

    it("handles MM/DD/YYYY date format from exercises", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.succeed({
          title: "Try Out Set 1 - Question 1",
          description: "Mathematics try out question",
          authors: [{ name: "Nakafa Team" }],
          date: "01/01/2026",
        })
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", [
          "exercises",
          "high-school",
          "snbt",
          "general-reasoning",
          "try-out",
          "set-1",
          "1",
        ])
      );

      expect(result.date).toBe("01/01/2026");
    });
  });

  describe("single parameter case", () => {
    it("handles single parameter (no nesting)", () => {
      mockGetFolderChildNames.mockImplementation((path: string) => {
        if (path === "categories") {
          return Effect.succeed(["politics", "economy", "sports"]);
        }
        return Effect.succeed([]);
      });

      const result = getStaticParams({
        basePath: "categories",
        paramNames: ["category"],
      });

      expect(result).toEqual([
        { category: "politics" },
        { category: "economy" },
        { category: "sports" },
      ]);
    });
  });

  describe("metadata subject fallback", () => {
    it("uses default description when both description and subject are missing", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.succeed({
          title: "Test Article",
          authors: [{ name: "Nakafa Team" }],
          date: "04/01/2025",
        })
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", ["articles", "politics", "test"])
      );

      expect(result.title).toBe("Test Article");
      expect(result.description).toBe("Short description");
      expect(result.authors).toEqual([{ name: "Nakafa Team" }]);
      expect(result.date).toBe("04/01/2025");
    });

    it("uses subject field when description is missing", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.succeed({
          title: "Algebra Fundamentals",
          subject: "Mathematics",
          authors: [{ name: "Nakafa Team" }],
          date: "04/01/2025",
        })
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", [
          "subject",
          "high-school",
          "10",
          "mathematics",
          "algebra",
        ])
      );

      expect(result.title).toBe("Algebra Fundamentals");
      expect(result.description).toBe("Mathematics");
      expect(result.authors).toEqual([{ name: "Nakafa Team" }]);
      expect(result.date).toBe("04/01/2025");
    });

    it("uses subject field when title and description are missing", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.succeed({
          subject: "Mathematics",
          authors: [{ name: "Nakafa Team" }],
          date: "04/01/2025",
        })
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", [
          "subject",
          "high-school",
          "10",
          "mathematics",
          "algebra",
        ])
      );

      expect(result.title).toBe("Made with Love");
      expect(result.description).toBe("Mathematics");
      expect(result.authors).toEqual([{ name: "Nakafa Team" }]);
      expect(result.date).toBe("04/01/2025");
    });
  });

  describe("locale fallback", () => {
    it("uses 'id' metadata when available", async () => {
      mockGetContentMetadata.mockImplementation((_filePath, locale) => {
        if (locale === "id") {
          return Effect.succeed({
            title: "Indonesian Title",
            description: "Indonesian Description",
            authors: [{ name: "Author" }],
            date: "01/01/2024",
          });
        }
        return Effect.succeed(null);
      });

      const result = await Effect.runPromise(
        getMetadataFromSlug("id", ["articles", "politics", "test"])
      );

      expect(result.title).toBe("Indonesian Title");
      expect(result.description).toBe("Indonesian Description");
    });

    it("returns default metadata when 'id' metadata not found", async () => {
      mockGetContentMetadata.mockReturnValue(Effect.succeed(null));

      const result = await Effect.runPromise(
        getMetadataFromSlug("id", ["articles", "politics", "test"])
      );

      expect(result.title).toBe("Made with Love");
      expect(result.description).toBe("Short description");
    });
  });

  describe("error handling", () => {
    it("fails when Common translation fails", async () => {
      const { getTranslations } = await import("next-intl/server");
      vi.mocked(getTranslations).mockRejectedValueOnce(
        new Error("Translation error")
      );

      const result = await Effect.runPromiseExit(
        getMetadataFromSlug("en", ["articles", "politics", "test"])
      );

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.cause._tag).toBe("Fail");
      }
    });

    it("fails when Metadata translation fails", async () => {
      const { getTranslations } = await import("next-intl/server");
      const commonTranslator = (key: string): string => {
        if (key === "made-with-love") {
          return "Made with Love";
        }
        return key;
      };
      vi.mocked(getTranslations)
        .mockResolvedValueOnce(
          Object.assign(commonTranslator, {
            rich: commonTranslator,
            markup: commonTranslator,
            raw: commonTranslator,
            has: () => false,
          }) as never
        )
        .mockRejectedValueOnce(new Error("Translation error"));

      const result = await Effect.runPromiseExit(
        getMetadataFromSlug("en", ["articles", "politics", "test"])
      );

      expect(result._tag).toBe("Failure");
    });

    it("returns default metadata when getContentMetadata fails with error", async () => {
      mockGetContentMetadata.mockReturnValue(
        Effect.fail(new Error("File not found"))
      );

      const result = await Effect.runPromise(
        getMetadataFromSlug("en", ["articles", "politics", "test"])
      );

      expect(result.title).toBe("Made with Love");
      expect(result.description).toBe("Short description");
    });
  });
});
