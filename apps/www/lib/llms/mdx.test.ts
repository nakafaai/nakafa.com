import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLlmsMdxText } from "@/lib/llms/mdx";

const runtimeMocks = vi.hoisted(() => ({
  applyContentRuntimeCache: vi.fn(),
  getRuntimeArticlePage: vi.fn(),
  getRuntimeCurriculumPage: vi.fn(),
}));

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: runtimeMocks.applyContentRuntimeCache,
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  getRuntimeArticlePage: runtimeMocks.getRuntimeArticlePage,
  getRuntimeCurriculumPage: runtimeMocks.getRuntimeCurriculumPage,
}));

vi.mock("@/lib/utils/github", () => ({
  getRawGithubUrl: (path: string) => `https://github.test${path}`,
}));

describe("getLlmsMdxText", () => {
  beforeEach(() => {
    runtimeMocks.applyContentRuntimeCache.mockReset();
    runtimeMocks.getRuntimeArticlePage.mockReset();
    runtimeMocks.getRuntimeCurriculumPage.mockReset();
    runtimeMocks.getRuntimeArticlePage.mockReturnValue(Effect.succeed(null));
    runtimeMocks.getRuntimeCurriculumPage.mockReturnValue(Effect.succeed(null));
  });

  it("loads cached markdown at the Next cache boundary", async () => {
    const { getCachedLlmsMdxText } = await import("@/lib/llms/mdx");
    runtimeMocks.getRuntimeArticlePage.mockReturnValue(
      Effect.succeed({
        body: "Article body",
        metadata: {
          description: "Article description",
          title: "Article title",
        },
      })
    );

    const text = await getCachedLlmsMdxText({
      cleanSlug: "articles/politics/example",
      locale: "en",
    });

    expect(runtimeMocks.applyContentRuntimeCache).toHaveBeenCalledTimes(1);
    expect(text).toContain("Article body");
  });

  it("returns article markdown from source article slugs", async () => {
    runtimeMocks.getRuntimeArticlePage.mockReturnValue(
      Effect.succeed({
        body: "Article body",
        metadata: {
          description: "Article description",
          title: "Article title",
        },
      })
    );

    const text = await Effect.runPromise(
      getLlmsMdxText({
        cleanSlug: "articles/politics/example",
        locale: "en",
      })
    );

    expect(runtimeMocks.getRuntimeArticlePage).toHaveBeenCalledWith({
      locale: "en",
      slug: "articles/politics/example",
    });
    expect(text).toContain("Article description");
    expect(text).toContain("Article body");
  });

  it("loads material lesson source slugs through the runtime material reader", async () => {
    runtimeMocks.getRuntimeCurriculumPage.mockReturnValue(
      Effect.succeed({
        body: "Lesson body",
        metadata: {
          description: "Lesson description",
          title: "Lesson title",
        },
      })
    );

    const text = await Effect.runPromise(
      getLlmsMdxText({
        cleanSlug: "material/lesson/chemistry/green-chemistry/definition",
        locale: "en",
        publicSlug: "subjects/chemistry/green-chemistry/definition",
      })
    );

    expect(runtimeMocks.getRuntimeCurriculumPage).toHaveBeenCalledWith({
      locale: "en",
      slug: "material/lesson/chemistry/green-chemistry/definition",
    });
    expect(text).toContain(
      "https://nakafa.com/en/subjects/chemistry/green-chemistry/definition"
    );
    expect(text).toContain("Lesson body");
  });

  it("loads curriculum source slugs through the runtime material reader", async () => {
    runtimeMocks.getRuntimeCurriculumPage.mockReturnValue(
      Effect.succeed({
        body: "Curriculum body",
        metadata: {
          subject: "Physics",
          title: "Curriculum title",
        },
      })
    );

    const text = await Effect.runPromise(
      getLlmsMdxText({
        cleanSlug: "curriculum/merdeka/class-10/physics",
        locale: "en",
      })
    );

    expect(runtimeMocks.getRuntimeCurriculumPage).toHaveBeenCalledWith({
      locale: "en",
      slug: "curriculum/merdeka/class-10/physics",
    });
    expect(text).toContain("Physics");
    expect(text).toContain("Curriculum body");
  });

  it("uses the generic markdown description when no page description exists", async () => {
    runtimeMocks.getRuntimeCurriculumPage.mockReturnValue(
      Effect.succeed({
        body: "Subjectless body",
        metadata: {
          subject: undefined,
          title: "Subjectless title",
        },
      })
    );

    const subjectlessText = await Effect.runPromise(
      getLlmsMdxText({
        cleanSlug: "material/lesson/chemistry/green-chemistry/definition",
        locale: "en",
      })
    );

    runtimeMocks.getRuntimeCurriculumPage.mockReturnValue(
      Effect.succeed({
        body: "Generic body",
        metadata: {
          title: "Generic title",
        },
      })
    );

    const genericText = await Effect.runPromise(
      getLlmsMdxText({
        cleanSlug: "material/lesson/chemistry/green-chemistry/definition",
        locale: "en",
      })
    );

    expect(subjectlessText).toContain(
      "Output docs content for large language models."
    );
    expect(genericText).toContain(
      "Output docs content for large language models."
    );
  });

  it("returns null when the slug is not backed by an MDX source", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMdxText({
          cleanSlug: "site/about",
          locale: "en",
        })
      )
    ).resolves.toBeNull();
  });
});
