import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLlmsMarkdownText,
  getLlmsSourceMarkdownText,
} from "@/lib/llms/content";

const mockGetCachedLlmsExerciseText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsMdxText = vi.hoisted(() => vi.fn());
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
    mockGetLlmsExerciseText.mockReset();
    mockGetLlmsSectionIndexText.mockReset();
    mockGetLlmsMdxText.mockReset();
    mockGetQuranLlmsText.mockReset();

    mockGetCachedLlmsExerciseText.mockResolvedValue(null);
    mockGetCachedLlmsSectionIndexText.mockResolvedValue(null);
    mockGetCachedLlmsMdxText.mockResolvedValue(null);
    mockGetLlmsExerciseText.mockResolvedValue(null);
    mockGetLlmsSectionIndexText.mockResolvedValue(null);
    mockGetLlmsMdxText.mockResolvedValue(null);
    mockGetQuranLlmsText.mockReturnValue(null);
  });

  it("returns Quran markdown before checking other content sources", async () => {
    mockGetQuranLlmsText.mockReturnValue("Quran markdown");

    await expect(
      getLlmsMarkdownText({ cleanSlug: "quran/1", locale: "en" })
    ).resolves.toBe("Quran markdown");

    expect(mockGetCachedLlmsExerciseText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns exercise markdown before MDX or index fallbacks", async () => {
    mockGetCachedLlmsExerciseText.mockResolvedValue("Exercise markdown");

    await expect(
      getLlmsMarkdownText({
        cleanSlug:
          "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9",
        locale: "en",
      })
    ).resolves.toBe("Exercise markdown");

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns MDX markdown before route index fallbacks", async () => {
    mockGetCachedLlmsMdxText.mockResolvedValue("MDX markdown");

    await expect(
      getLlmsMarkdownText({
        cleanSlug:
          "subject/high-school/10/chemistry/green-chemistry/definition",
        locale: "id",
      })
    ).resolves.toBe("MDX markdown");

    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns sitemap-derived route indexes when page markdown is absent", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValue("Index markdown");

    await expect(
      getLlmsMarkdownText({
        cleanSlug: "subject/high-school/10/chemistry",
        locale: "en",
      })
    ).resolves.toBe("Index markdown");

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/subject/high-school/10/chemistry",
    });
  });

  it("returns null when no markdown source exists", async () => {
    await expect(
      getLlmsMarkdownText({ cleanSlug: "articles/missing", locale: "en" })
    ).resolves.toBeNull();
  });

  it("uses uncached source builders for build-time artifacts", async () => {
    mockGetLlmsSectionIndexText.mockResolvedValue("Source index markdown");

    await expect(
      getLlmsSourceMarkdownText({
        cleanSlug: "subject/high-school/10/chemistry",
        locale: "en",
      })
    ).resolves.toBe("Source index markdown");

    expect(mockGetLlmsSectionIndexText).toHaveBeenCalledWith(
      "llms/en/subject/high-school/10/chemistry"
    );
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source Quran markdown before checking uncached builders", async () => {
    mockGetQuranLlmsText.mockReturnValue("Source Quran markdown");

    await expect(
      getLlmsSourceMarkdownText({ cleanSlug: "quran/1", locale: "id" })
    ).resolves.toBe("Source Quran markdown");

    expect(mockGetLlmsExerciseText).not.toHaveBeenCalled();
    expect(mockGetLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source exercise markdown before source MDX or indexes", async () => {
    mockGetLlmsExerciseText.mockResolvedValue("Source exercise markdown");

    await expect(
      getLlmsSourceMarkdownText({
        cleanSlug:
          "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1",
        locale: "en",
      })
    ).resolves.toBe("Source exercise markdown");

    expect(mockGetLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns source MDX markdown before source index fallbacks", async () => {
    mockGetLlmsMdxText.mockResolvedValue("Source MDX markdown");

    await expect(
      getLlmsSourceMarkdownText({
        cleanSlug:
          "subject/high-school/10/chemistry/green-chemistry/definition",
        locale: "id",
      })
    ).resolves.toBe("Source MDX markdown");

    expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
  });
});
