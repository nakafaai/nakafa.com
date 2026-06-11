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

  it("returns exercise markdown before MDX or index fallbacks", async () => {
    mockGetCachedLlmsExerciseText.mockResolvedValue("Exercise markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug:
            "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9",
          locale: "en",
        })
      )
    ).resolves.toBe("Exercise markdown");

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns MDX markdown before route index fallbacks", async () => {
    mockGetCachedLlmsMdxText.mockResolvedValue("MDX markdown");

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug:
            "subject/high-school/10/chemistry/green-chemistry/definition",
          locale: "id",
        })
      )
    ).resolves.toBe("MDX markdown");

    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns legal source markdown before route index fallbacks", async () => {
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
          cleanSlug: "subject/high-school/10/chemistry",
          locale: "en",
        })
      )
    ).resolves.toBe("Index markdown");

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/subject/high-school/10/chemistry",
    });
  });

  it("returns null when no markdown source exists", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "articles/missing", locale: "en" })
      )
    ).resolves.toBeNull();
  });

  it("surfaces cached exercise markdown failures", async () => {
    const error = new Error("exercise failed");
    mockGetCachedLlmsExerciseText.mockRejectedValue(error);

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "exercises/missing", locale: "en" })
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
        getLlmsMarkdownText({ cleanSlug: "subject/missing", locale: "en" })
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
          cleanSlug: "subject/high-school/10/chemistry",
          locale: "en",
        })
      )
    ).resolves.toBe("Source index markdown");

    expect(mockGetLlmsSectionIndexText).toHaveBeenCalledWith(
      "llms/en/subject/high-school/10/chemistry"
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
            "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1",
          locale: "en",
        })
      )
    ).resolves.toBe("Source exercise markdown");

    expect(mockGetLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source MDX markdown before source index fallbacks", async () => {
    mockGetLlmsMdxText.mockReturnValue(Effect.succeed("Source MDX markdown"));

    await expect(
      Effect.runPromise(
        getLlmsSourceMarkdownText({
          cleanSlug:
            "subject/high-school/10/chemistry/green-chemistry/definition",
          locale: "id",
        })
      )
    ).resolves.toBe("Source MDX markdown");

    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source legal markdown before source index fallbacks", async () => {
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
