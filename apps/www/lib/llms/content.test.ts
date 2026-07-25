// @vitest-environment node
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLlmsMarkdownText } from "@/lib/llms/content";

const PUBLISHED_PATH =
  "subjects/mathematics/function-composition-inverse-function/function-concept";
const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsMdxText = vi.hoisted(() => vi.fn());
const mockGetCachedPublishedMaterialText = vi.hoisted(() => vi.fn());
const mockGetLlmsLegalPageText = vi.hoisted(() => vi.fn());
const mockGetQuranLlmsText = vi.hoisted(() => vi.fn());
const mockGetRuntimePublicRoute = vi.hoisted(() => vi.fn());
const mockReadActiveMaterialRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const activeReleaseId = "release-active";

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimePublicRoute: mockGetRuntimePublicRoute,
}));

vi.mock("@/lib/content/published/route", () => ({
  readActiveMaterialRoute: mockReadActiveMaterialRoute,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: mockReadActiveContentIdentity,
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

vi.mock("@/lib/llms/published", () => ({
  getCachedPublishedMaterialText: mockGetCachedPublishedMaterialText,
}));

vi.mock("@/lib/llms/quran", () => ({
  getQuranLlmsText: mockGetQuranLlmsText,
}));

/** Asserts one cache rejection remains a typed Effect failure. */
async function expectCacheFailure(
  cleanSlug: string,
  cause: Error,
  owner: string
) {
  const program = getLlmsMarkdownText({ cleanSlug, locale: "en" });
  await expect(Effect.runPromise(Effect.flip(program))).resolves.toMatchObject({
    _tag: "CacheFailure",
    cause,
    owner,
  });
}

/** Resolves one markdown route at the framework runner boundary. */
function readMarkdown(cleanSlug: string, locale: Locale = "en") {
  return Effect.runPromise(getLlmsMarkdownText({ cleanSlug, locale }));
}

/** Verifies that one route has no body-bearing markdown source. */
async function expectNoSourceMarkdown(cleanSlug: string) {
  await expect(readMarkdown(cleanSlug)).resolves.toBeNull();
  expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
  expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
}

describe("llms markdown content resolver", () => {
  beforeEach(() => {
    mockGetCachedLlmsSectionIndexText.mockReset().mockResolvedValue(null);
    mockGetCachedLlmsMdxText.mockReset().mockResolvedValue(null);
    mockGetCachedPublishedMaterialText.mockReset().mockResolvedValue(null);
    mockGetLlmsLegalPageText.mockReset().mockReturnValue(Effect.succeed(null));
    mockGetQuranLlmsText.mockReset().mockReturnValue(Effect.succeed(null));
    mockGetRuntimePublicRoute.mockReset();
    mockReadActiveMaterialRoute.mockReset();
    mockReadActiveContentIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: activeReleaseId }));

    mockReadActiveMaterialRoute.mockImplementation(({ publicPath }) =>
      Effect.succeed(
        publicPath === PUBLISHED_PATH
          ? { activeReleaseId, kind: "found" }
          : { activeReleaseId, kind: "unmanaged" }
      )
    );
    mockGetRuntimePublicRoute.mockImplementation(({ publicPath }) => {
      if (publicPath === "subjects/chemistry/green-chemistry/definition") {
        return Effect.succeed({
          kind: "subject-lesson",
          sourcePath: "material/lesson/chemistry/green-chemistry/definition",
        });
      }

      if (publicPath === PUBLISHED_PATH) {
        return Effect.succeed({
          kind: "subject-lesson",
          locale: "en",
          sourcePath:
            "material/lesson/mathematics/function-composition-inverse-function/function-concept",
        });
      }

      if (publicPath.startsWith("curriculum/")) {
        return Effect.succeed({ kind: "curriculum-context" });
      }

      return Effect.succeed(null);
    });
  });

  it("reads migrated public material markdown only from Aksara", async () => {
    mockGetCachedPublishedMaterialText.mockResolvedValue("Aksara markdown");

    await expect(readMarkdown(PUBLISHED_PATH)).resolves.toBe("Aksara markdown");

    expect(mockGetCachedPublishedMaterialText).toHaveBeenCalledWith({
      activeReleaseId,
      locale: "en",
      publicPath: PUBLISHED_PATH,
    });
    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
  });

  it("types cached Aksara markdown failures", async () => {
    const error = new Error("Aksara markdown failed");
    mockGetCachedPublishedMaterialText.mockRejectedValue(error);

    await expectCacheFailure(PUBLISHED_PATH, error, "published");
  });

  it("reads a newly published material route without an old route row", async () => {
    const publicPath = "subjects/mathematics/new-topic/new-lesson";
    mockReadActiveMaterialRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId, kind: "found" })
    );
    mockGetCachedPublishedMaterialText.mockResolvedValue("New markdown");

    await expect(readMarkdown(publicPath)).resolves.toBe("New markdown");

    expect(mockGetCachedPublishedMaterialText).toHaveBeenCalledWith({
      activeReleaseId,
      locale: "en",
      publicPath,
    });
    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
  });

  it("does not fall back after an owned material route is deleted", async () => {
    const publicPath = "subjects/chemistry/green-chemistry/definition";
    mockReadActiveMaterialRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId, kind: "missing" })
    );

    await expect(readMarkdown(publicPath)).resolves.toBeNull();

    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedPublishedMaterialText).not.toHaveBeenCalled();
  });

  it("keys unmanaged source ownership to no active release", async () => {
    const publicPath = "subjects/chemistry/green-chemistry/definition";
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
    mockReadActiveMaterialRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
    );
    mockGetCachedLlmsMdxText.mockResolvedValue("Source markdown");

    await expect(readMarkdown(publicPath)).resolves.toBe("Source markdown");
    expect(mockReadActiveMaterialRoute).toHaveBeenCalledWith({
      activeReleaseId: null,
      locale: "en",
      publicPath,
    });
  });

  it("returns Quran markdown before checking other content sources", async () => {
    mockGetQuranLlmsText.mockReturnValue(Effect.succeed("Quran markdown"));

    await expect(readMarkdown("quran/1")).resolves.toBe("Quran markdown");

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns MDX markdown before route indexes", async () => {
    mockGetCachedLlmsMdxText.mockResolvedValue("MDX markdown");

    await expect(
      readMarkdown("material/lesson/chemistry/green-chemistry/definition", "id")
    ).resolves.toBe("MDX markdown");

    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("resolves public material routes to source markdown without changing the public URL", async () => {
    mockGetCachedLlmsMdxText.mockResolvedValue("MDX markdown");

    await expect(
      readMarkdown("subjects/chemistry/green-chemistry/definition")
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
    await expectNoSourceMarkdown(
      "curriculum/merdeka/class-12/mathematics/integral"
    );
  });

  it("does not invent markdown for try-out catalog routes without a source document", async () => {
    await expectNoSourceMarkdown("try-out/indonesia/snbt");
  });

  it("does not invent markdown when an indexed public route has no source path", async () => {
    mockGetRuntimePublicRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "subject-lesson" })
    );

    await expect(
      readMarkdown("subjects/mathematics/integral/area")
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
  });

  it("returns legal source markdown before route indexes", async () => {
    mockGetLlmsLegalPageText.mockReturnValue(Effect.succeed("Legal markdown"));

    await expect(readMarkdown("terms-of-service")).resolves.toBe(
      "Legal markdown"
    );

    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("returns sitemap-derived route indexes when page markdown is absent", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValue("Index markdown");

    await expect(readMarkdown("articles/politics")).resolves.toBe(
      "Index markdown"
    );

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/articles/politics",
    });
  });

  it("returns null when no markdown source exists", async () => {
    await expect(readMarkdown("articles/missing")).resolves.toBeNull();
  });

  it("treats invalid projected markdown paths as unsupported content", async () => {
    await expect(
      readMarkdown("subjects/mathematics/integral/invalid.segment")
    ).resolves.toBeNull();

    expect(mockGetCachedLlmsMdxText).not.toHaveBeenCalled();
    expect(mockGetRuntimePublicRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "subjects/mathematics/integral/invalid.segment",
    });
  });

  it("treats the empty markdown slug as an unsupported route index", async () => {
    await expect(readMarkdown("")).resolves.toBeNull();

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/",
    });
  });

  it.each([
    ["MDX markdown", mockGetCachedLlmsMdxText, "mdx failed", "source"],
    [
      "section index",
      mockGetCachedLlmsSectionIndexText,
      "index failed",
      "index",
    ],
  ])("types cached %s failures", async (_kind, cache, message, owner) => {
    const error = new Error(message);
    cache.mockRejectedValue(error);
    await expectCacheFailure("articles/missing", error, owner);
  });

  it("surfaces indexed public-route lookup failures", async () => {
    const error = new Error("route lookup failed");
    mockGetRuntimePublicRoute.mockReturnValueOnce(Effect.fail(error));

    await expect(readMarkdown("subjects/mathematics/integral")).rejects.toThrow(
      error.message
    );
  });

  it("surfaces active material-route lookup failures", async () => {
    const error = new Error("active route lookup failed");
    mockReadActiveMaterialRoute.mockReturnValueOnce(Effect.fail(error));

    await expect(readMarkdown(PUBLISHED_PATH)).rejects.toThrow(error.message);

    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
  });
});
