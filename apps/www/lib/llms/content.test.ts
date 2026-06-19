// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLlmsMarkdownText,
  getLlmsSourceMarkdownText,
} from "@/lib/llms/content";

const mockGetCachedLlmsExerciseText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsMdxText = vi.hoisted(() => vi.fn());
const mockGetLlmsLegalPageText = vi.hoisted(() => vi.fn());
const mockGetLlmsExerciseText = vi.hoisted(() => vi.fn());
const mockGetLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockGetLlmsMdxText = vi.hoisted(() => vi.fn());
const mockGetQuranLlmsText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/exercises", () => ({
  getCachedLlmsExerciseText: mockGetCachedLlmsExerciseText,
  getLlmsExerciseText: mockGetLlmsExerciseText,
}));

vi.mock("@/lib/llms/indexes", () => ({
  getCachedLlmsSectionIndexText: mockGetCachedLlmsSectionIndexText,
  getLlmsSectionIndexText: mockGetLlmsSectionIndexText,
}));

vi.mock("@/lib/llms/legal", () => ({
  getLlmsLegalPageText: mockGetLlmsLegalPageText,
}));

vi.mock("@/lib/llms/mdx", () => ({
  getCachedLlmsMdxText: mockGetCachedLlmsMdxText,
  getLlmsMdxText: mockGetLlmsMdxText,
}));

vi.mock("@/lib/llms/quran", () => ({
  getQuranLlmsText: mockGetQuranLlmsText,
}));

describe("llms markdown content resolver", () => {
  beforeEach(() => {
    mockGetCachedLlmsExerciseText.mockReset();
    mockGetCachedLlmsSectionIndexText.mockReset();
    mockGetCachedLlmsMdxText.mockReset();
    mockGetLlmsLegalPageText.mockReset();
    mockGetLlmsExerciseText.mockReset();
    mockGetLlmsSectionIndexText.mockReset();
    mockGetLlmsMdxText.mockReset();
    mockGetQuranLlmsText.mockReset();

    mockGetCachedLlmsExerciseText.mockResolvedValue(null);
    mockGetCachedLlmsSectionIndexText.mockResolvedValue(null);
    mockGetCachedLlmsMdxText.mockResolvedValue(null);
    mockGetLlmsLegalPageText.mockReturnValue(Effect.succeed(null));
    mockGetLlmsExerciseText.mockReturnValue(Effect.succeed(null));
    mockGetLlmsSectionIndexText.mockReturnValue(Effect.succeed(null));
    mockGetLlmsMdxText.mockReturnValue(Effect.succeed(null));
    mockGetQuranLlmsText.mockReturnValue(Effect.succeed(null));
  });

  it("returns Quran markdown before checking other content sources", async () => {
    mockGetQuranLlmsText.mockReturnValue(Effect.succeed("Quran markdown"));

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "quran/1", locale: "en" })
      )
    ).resolves.toBe("Quran markdown");

    expect(mockGetCachedLlmsExerciseText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns exercise markdown before MDX or route indexes", async () => {
    mockGetCachedLlmsExerciseText.mockResolvedValue("Exercise markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug:
            "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1/9",
          locale: "en",
        })
      )
    ).resolves.toBe("Exercise markdown");

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns MDX markdown before route indexes", async () => {
    mockGetCachedLlmsMdxText.mockResolvedValue("MDX markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "material/lesson/chemistry/green-chemistry/definition",
          locale: "id",
        })
      )
    ).resolves.toBe("MDX markdown");

    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("resolves public material routes to source markdown without changing the public URL", async () => {
    mockGetCachedLlmsMdxText.mockResolvedValue("MDX markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "subjects/chemistry/green-chemistry/definition",
          locale: "en",
        })
      )
    ).resolves.toBe("MDX markdown");

    expect(mockGetCachedLlmsMdxText).toHaveBeenCalledWith({
      cleanSlug: "material/lesson/chemistry/green-chemistry/definition",
      locale: "en",
      publicSlug: "subjects/chemistry/green-chemistry/definition",
    });
  });

  it("resolves public practice routes to source exercise markdown", async () => {
    mockGetCachedLlmsExerciseText.mockResolvedValue("Exercise markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug:
            "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9",
          locale: "en",
        })
      )
    ).resolves.toBe("Exercise markdown");

    expect(mockGetCachedLlmsExerciseText).toHaveBeenCalledWith({
      cleanSlug:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
      locale: "en",
      publicSlug:
        "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9",
    });
  });

  it("does not invent markdown for curriculum and assessment context routes", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "curriculum/merdeka/class-12/mathematics/integral",
          locale: "en",
        })
      )
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "exams/snbt/quantitative-knowledge",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsExerciseText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns legal source markdown before route indexes", async () => {
    mockGetLlmsLegalPageText.mockReturnValue(Effect.succeed("Legal markdown"));

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "terms-of-service",
          locale: "en",
        })
      )
    ).resolves.toBe("Legal markdown");

    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns sitemap-derived route indexes when page markdown is absent", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValue("Index markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "articles/politics",
          locale: "en",
        })
      )
    ).resolves.toBe("Index markdown");

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/articles/politics",
    });
  });

  it("returns null when no markdown source exists", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "articles/missing", locale: "en" })
      )
    ).resolves.toBeNull();
  });

  it("treats invalid projected markdown paths as unsupported content", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "subjects/mathematics/integral/invalid.segment",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsMdxText).toHaveBeenCalledWith({
      cleanSlug: "subjects/mathematics/integral/invalid.segment",
      locale: "en",
      publicSlug: undefined,
    });
  });

  it("treats the empty markdown slug as an unsupported route index", async () => {
    await expect(
      Effect.runPromise(getLlmsMarkdownText({ cleanSlug: "", locale: "en" }))
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/",
    });
  });

  it("surfaces cached exercise markdown failures", async () => {
    const error = new Error("exercise failed");
    mockGetCachedLlmsExerciseText.mockRejectedValue(error);

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "exams/missing", locale: "en" })
      )
    ).rejects.toThrow(error.message);
  });

  it("surfaces cached MDX markdown failures", async () => {
    const error = new Error("mdx failed");
    mockGetCachedLlmsMdxText.mockRejectedValue(error);

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "articles/missing", locale: "en" })
      )
    ).rejects.toThrow(error.message);
  });

  it("surfaces cached section index failures", async () => {
    const error = new Error("index failed");
    mockGetCachedLlmsSectionIndexText.mockRejectedValue(error);

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "curriculum/missing", locale: "en" })
      )
    ).rejects.toThrow(error.message);
  });

  it("uses uncached source builders for build-time artifacts", async () => {
    mockGetLlmsSectionIndexText.mockReturnValue(
      Effect.succeed("Source index markdown")
    );

    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({
          cleanSlug: "articles/politics",
          locale: "en",
        })
      )
    ).resolves.toBe("Source index markdown");

    expect(mockGetLlmsSectionIndexText).toHaveBeenCalledWith(
      "llms/en/articles/politics"
    );
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source Quran markdown before checking uncached builders", async () => {
    mockGetQuranLlmsText.mockReturnValue(
      Effect.succeed("Source Quran markdown")
    );

    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({ cleanSlug: "quran/1", locale: "id" })
      )
    ).resolves.toBe("Source Quran markdown");

    expect(mockGetLlmsExerciseText).not.toHaveBeenCalled();
    expect(mockGetLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source exercise markdown before source MDX or indexes", async () => {
    mockGetLlmsExerciseText.mockReturnValue(
      Effect.succeed("Source exercise markdown")
    );

    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({
          cleanSlug:
            "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-1",
          locale: "en",
        })
      )
    ).resolves.toBe("Source exercise markdown");

    expect(mockGetLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source MDX markdown before source indexes", async () => {
    mockGetLlmsMdxText.mockReturnValue(Effect.succeed("Source MDX markdown"));

    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({
          cleanSlug: "material/lesson/chemistry/green-chemistry/definition",
          locale: "id",
        })
      )
    ).resolves.toBe("Source MDX markdown");

    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("does not build source artifacts for context routes without markdown", async () => {
    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({
          cleanSlug: "curriculum/merdeka/class-10/mathematics",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetLlmsExerciseText).not.toHaveBeenCalled();
    expect(mockGetLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source legal markdown before source indexes", async () => {
    mockGetLlmsLegalPageText.mockReturnValue(
      Effect.succeed("Source legal markdown")
    );

    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({
          cleanSlug: "terms-of-service",
          locale: "en",
        })
      )
    ).resolves.toBe("Source legal markdown");

    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });
});
