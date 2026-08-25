// @vitest-environment node
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLlmsMarkdownText, hasLlmsMarkdownSource } from "@/lib/llms/content";

const PUBLISHED_PATH =
  "subjects/mathematics/function-composition-inverse-function/function-concept";
const PUBLISHED_ARTICLE_PATH = "articles/politics/regional-elections-turmoil";
const PUBLISHED_PAGE_PATH = "terms-of-service";
const PUBLISHED_NESTED_PAGE_PATH = "legal/terms-of-service";
const NEW_PATH = "subjects/mathematics/new-topic/new-lesson";
const SOURCE_PUBLIC_PATH = "subjects/chemistry/green-chemistry/definition";
const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockGetCachedPublishedText = vi.hoisted(() => vi.fn());
const mockClassifyQuranLlmsRoute = vi.hoisted(() => vi.fn());
const mockGetQuranLlmsText = vi.hoisted(() => vi.fn());
const mockIsPublicLlmsLocaleIndexRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const mockResolvePublicLlmsSectionIndex = vi.hoisted(() => vi.fn());
const activeReleaseId = "release-active";

vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: mockReadActiveContentRoute,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: mockReadActiveContentIdentity,
}));

vi.mock("@/lib/llms/indexes", () => ({
  getCachedLlmsSectionIndexText: mockGetCachedLlmsSectionIndexText,
}));

vi.mock("@/lib/llms/published", () => ({
  getCachedPublishedText: mockGetCachedPublishedText,
}));

vi.mock("@/lib/llms/quran", () => ({
  classifyQuranLlmsRoute: mockClassifyQuranLlmsRoute,
  getQuranLlmsText: mockGetQuranLlmsText,
}));

vi.mock("@/lib/llms/public-index", () => ({
  isPublicLlmsLocaleIndexRoute: mockIsPublicLlmsLocaleIndexRoute,
  resolvePublicLlmsSectionIndex: mockResolvePublicLlmsSectionIndex,
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

/** Verifies that one route has no body-bearing signed markdown. */
async function expectNoPublishedMarkdown(cleanSlug: string) {
  await expect(readMarkdown(cleanSlug)).resolves.toBeNull();
  expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
}

describe("llms markdown content resolver", () => {
  beforeEach(() => {
    mockGetCachedLlmsSectionIndexText.mockReset().mockResolvedValue(null);
    mockGetCachedPublishedText.mockReset().mockResolvedValue(null);
    mockClassifyQuranLlmsRoute.mockReset().mockReturnValue(Option.none());
    mockGetQuranLlmsText.mockReset().mockReturnValue(Effect.succeed(null));
    mockIsPublicLlmsLocaleIndexRoute.mockReset().mockReturnValue(false);
    mockReadActiveContentRoute.mockReset();
    mockResolvePublicLlmsSectionIndex.mockReset().mockReturnValue(null);
    mockReadActiveContentIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: activeReleaseId }));

    mockReadActiveContentRoute.mockImplementation(({ publicPath }) =>
      Effect.succeed(
        publicPath === PUBLISHED_PATH ||
          publicPath === PUBLISHED_ARTICLE_PATH ||
          publicPath === PUBLISHED_PAGE_PATH ||
          publicPath === PUBLISHED_NESTED_PAGE_PATH
          ? { activeReleaseId, kind: "found" }
          : { activeReleaseId, kind: "unmanaged" }
      )
    );
  });

  it("reads migrated public material markdown only from Aksara", async () => {
    mockGetCachedPublishedText.mockResolvedValue("Aksara markdown");

    await expect(readMarkdown(PUBLISHED_PATH)).resolves.toBe("Aksara markdown");

    expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "material",
      publicPath: PUBLISHED_PATH,
    });
  });

  it("types cached Aksara markdown failures", async () => {
    const error = new Error("Aksara markdown failed");
    mockGetCachedPublishedText.mockRejectedValue(error);

    await expectCacheFailure(PUBLISHED_PATH, error, "published");
  });

  it("reads a newly published material route without an old route row", async () => {
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId, kind: "found" })
    );
    mockGetCachedPublishedText.mockResolvedValue("New markdown");

    await expect(readMarkdown(NEW_PATH)).resolves.toBe("New markdown");

    expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "material",
      publicPath: NEW_PATH,
    });
  });

  it("does not fall back after an owned material route is deleted", async () => {
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId, kind: "missing" })
    );

    await expect(readMarkdown(SOURCE_PUBLIC_PATH)).resolves.toBeNull();

    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
  });

  it("reads an owned article body from the generic Aksara markdown seam", async () => {
    mockGetCachedPublishedText.mockResolvedValue("Published article");

    await expect(readMarkdown(PUBLISHED_ARTICLE_PATH)).resolves.toBe(
      "Published article"
    );
    expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "article",
      publicPath: PUBLISHED_ARTICLE_PATH,
    });
    expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "article",
      publicPath: PUBLISHED_ARTICLE_PATH,
    });
  });

  it("does not fall back after an owned article route is deleted", async () => {
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId, kind: "missing" })
    );

    await expect(readMarkdown(PUBLISHED_ARTICLE_PATH)).resolves.toBeNull();

    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
  });

  it("fails closed when signed material ownership is unavailable", async () => {
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
    );

    await expect(readMarkdown(SOURCE_PUBLIC_PATH)).resolves.toBeNull();
    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
  });

  it("returns Quran markdown before checking signed content", async () => {
    mockGetQuranLlmsText.mockReturnValue(Effect.succeed("Quran markdown"));

    await expect(readMarkdown("quran/1")).resolves.toBe("Quran markdown");

    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("does not invent markdown for curriculum context routes", async () => {
    await expectNoPublishedMarkdown(
      "curriculum/merdeka/class-12/mathematics/integral"
    );
  });

  it("does not invent markdown for try-out catalog routes without a source document", async () => {
    await expectNoPublishedMarkdown("try-out/indonesia/snbt");
    await expect(
      readMarkdown("try-out/indonesia/snbt/2027/set-1")
    ).resolves.toBeNull();
    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
  });

  it("reads a reviewed Page body through the same signed markdown seam", async () => {
    mockGetCachedPublishedText.mockResolvedValue("Signed Page markdown");

    await expect(readMarkdown("terms-of-service")).resolves.toBe(
      "Signed Page markdown"
    );

    expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "page",
      publicPath: PUBLISHED_PAGE_PATH,
    });
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("reads a nested reviewed Page without assuming one route segment", async () => {
    mockGetCachedPublishedText.mockResolvedValue("Nested signed Page markdown");

    await expect(readMarkdown(PUBLISHED_NESTED_PAGE_PATH)).resolves.toBe(
      "Nested signed Page markdown"
    );

    expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "page",
      publicPath: PUBLISHED_NESTED_PAGE_PATH,
    });
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

  it("falls through when an owned route has no body markdown", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValue("Fallback index");

    await expect(readMarkdown(PUBLISHED_PATH)).resolves.toBe("Fallback index");

    expect(mockGetCachedPublishedText).toHaveBeenCalledTimes(1);
    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: `llms/en/${PUBLISHED_PATH}`,
    });
  });

  it("returns null when no markdown source exists", async () => {
    await expect(readMarkdown("articles/missing")).resolves.toBeNull();
  });

  it("recognizes a route owned by a public Markdown index", async () => {
    mockResolvePublicLlmsSectionIndex.mockReturnValueOnce({
      label: "Curriculum",
      prefix: "curriculum",
    });

    await expect(
      Effect.runPromise(
        hasLlmsMarkdownSource({ cleanSlug: "curriculum", locale: "en" })
      )
    ).resolves.toBe(true);

    expect(mockClassifyQuranLlmsRoute).not.toHaveBeenCalled();
    expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
    expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
  });

  it.each(["", "llms"])(
    "recognizes locale index %j without reading its body",
    async (cleanSlug) => {
      mockIsPublicLlmsLocaleIndexRoute.mockReturnValueOnce(true);

      await expect(
        Effect.runPromise(hasLlmsMarkdownSource({ cleanSlug, locale: "en" }))
      ).resolves.toBe(true);

      expect(mockIsPublicLlmsLocaleIndexRoute).toHaveBeenCalledWith(cleanSlug);
      expect(mockResolvePublicLlmsSectionIndex).not.toHaveBeenCalled();
      expect(mockClassifyQuranLlmsRoute).not.toHaveBeenCalled();
      expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
      expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
      expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
      expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
    }
  );

  it("recognizes Quran ownership without reading its body twice", async () => {
    mockClassifyQuranLlmsRoute.mockReturnValueOnce(
      Option.some({ kind: "surah", surahNumber: 1 })
    );

    await expect(
      Effect.runPromise(
        hasLlmsMarkdownSource({ cleanSlug: "quran/1", locale: "en" })
      )
    ).resolves.toBe(true);

    expect(mockClassifyQuranLlmsRoute).toHaveBeenCalledWith("quran/1");
    expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
    expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
  });

  it("reports availability only when the real source chain returns text", async () => {
    mockGetCachedLlmsSectionIndexText
      .mockResolvedValueOnce("Index markdown")
      .mockResolvedValueOnce(null);

    await expect(
      Effect.runPromise(
        hasLlmsMarkdownSource({ cleanSlug: "articles/politics", locale: "en" })
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        hasLlmsMarkdownSource({ cleanSlug: "search", locale: "en" })
      )
    ).resolves.toBe(false);
  });

  it("treats invalid projected markdown paths as unsupported content", async () => {
    await expect(
      readMarkdown("subjects/mathematics/integral/invalid.segment")
    ).resolves.toBeNull();

    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
    expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId,
      appLocale: "en",
      family: "material",
      publicPath: "subjects/mathematics/integral/invalid.segment",
    });
  });

  it("treats the empty markdown slug as an unsupported route index", async () => {
    await expect(readMarkdown("")).resolves.toBeNull();

    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/",
    });
  });

  it("types cached section-index failures", async () => {
    const error = new Error("index failed");
    mockGetCachedLlmsSectionIndexText.mockRejectedValue(error);

    await expectCacheFailure("articles/missing", error, "index");
  });

  it("surfaces active material-route lookup failures", async () => {
    const error = new Error("active route lookup failed");
    mockReadActiveContentRoute.mockReturnValueOnce(Effect.fail(error));

    await expect(readMarkdown(PUBLISHED_PATH)).rejects.toThrow(error.message);
  });
});
