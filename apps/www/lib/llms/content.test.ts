// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLlmsMarkdownText } from "@/lib/llms/content";

const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsMdxText = vi.hoisted(() => vi.fn());
const mockGetLlmsLegalPageText = vi.hoisted(() => vi.fn());
const mockGetQuranLlmsText = vi.hoisted(() => vi.fn());
const mockGetRuntimePublicRoute = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimePublicRoute: mockGetRuntimePublicRoute,
}));

vi.mock("@/lib/llms/indexes", () => ({
  getCachedLlmsSectionIndexText: mockGetCachedLlmsSectionIndexText,
}));

vi.mock("@/lib/llms/legal", () => ({
  getLlmsLegalPageText: mockGetLlmsLegalPageText,
}));

vi.mock("@/lib/llms/mdx", () => ({
  getCachedLlmsMdxText: mockGetCachedLlmsMdxText,
}));

vi.mock("@/lib/llms/quran", () => ({
  getQuranLlmsText: mockGetQuranLlmsText,
}));

describe("llms markdown content resolver", () => {
  beforeEach(() => {
    mockGetCachedLlmsSectionIndexText.mockReset();
    mockGetCachedLlmsMdxText.mockReset();
    mockGetLlmsLegalPageText.mockReset();
    mockGetQuranLlmsText.mockReset();
    mockGetRuntimePublicRoute.mockReset();

    mockGetCachedLlmsSectionIndexText.mockResolvedValue(null);
    mockGetCachedLlmsMdxText.mockResolvedValue(null);
    mockGetLlmsLegalPageText.mockReturnValue(Effect.succeed(null));
    mockGetQuranLlmsText.mockReturnValue(Effect.succeed(null));
    mockGetRuntimePublicRoute.mockImplementation(({ publicPath }) => {
      if (publicPath === "subjects/chemistry/green-chemistry/definition") {
        return Effect.succeed({
          kind: "subject-lesson",
          sourcePath: "material/lesson/chemistry/green-chemistry/definition",
        });
      }

      if (publicPath.startsWith("curriculum/")) {
        return Effect.succeed({ kind: "curriculum-context" });
      }

      return Effect.succeed(null);
    });
  });

  it("returns Quran markdown before checking other content sources", async () => {
    mockGetQuranLlmsText.mockReturnValue(Effect.succeed("Quran markdown"));

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({ cleanSlug: "quran/1", locale: "en" })
      )
    ).resolves.toBe("Quran markdown");

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
    expect(mockGetRuntimePublicRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "subjects/chemistry/green-chemistry/definition",
    });
  });

  it("does not invent markdown for curriculum context routes", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "curriculum/merdeka/class-12/mathematics/integral",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("does not invent markdown for try-out catalog routes without a source document", async () => {
    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "try-out/indonesia/snbt",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("does not invent markdown when an indexed public route has no source path", async () => {
    mockGetRuntimePublicRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "subject-lesson" })
    );

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "subjects/mathematics/integral/area",
          locale: "en",
        })
      )
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
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

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetRuntimePublicRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "subjects/mathematics/integral/invalid.segment",
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
        getLlmsMarkdownText({ cleanSlug: "articles/missing", locale: "en" })
      )
    ).rejects.toThrow(error.message);
  });

  it("surfaces indexed public-route lookup failures", async () => {
    const error = new Error("route lookup failed");
    mockGetRuntimePublicRoute.mockReturnValueOnce(Effect.fail(error));

    await expect(
      Effect.runPromise(
        getLlmsMarkdownText({
          cleanSlug: "subjects/mathematics/integral",
          locale: "en",
        })
      )
    ).rejects.toThrow(error.message);
  });
});
