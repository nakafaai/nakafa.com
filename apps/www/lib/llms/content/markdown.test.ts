// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { vi } from "vitest";
import {
  getLlmsMarkdownText,
  hasLlmsMarkdownSource,
} from "@/lib/llms/content/markdown";

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

vi.mock("@/lib/llms/index/cache", () => ({
  getCachedLlmsSectionIndexText: mockGetCachedLlmsSectionIndexText,
}));

vi.mock("@/lib/llms/published", () => ({
  getCachedPublishedText: mockGetCachedPublishedText,
}));

vi.mock("@/lib/llms/quran", () => ({
  classifyQuranLlmsRoute: mockClassifyQuranLlmsRoute,
  getQuranLlmsText: mockGetQuranLlmsText,
}));

vi.mock("@/lib/llms/index/public", () => ({
  isPublicLlmsLocaleIndexRoute: mockIsPublicLlmsLocaleIndexRoute,
  resolvePublicLlmsSectionIndex: mockResolvePublicLlmsSectionIndex,
}));

/** Asserts one cache rejection remains a typed Effect failure. */
function expectCacheFailure(cleanSlug: string, cause: Error, owner: string) {
  return Effect.gen(function* () {
    const failure = yield* getLlmsMarkdownText({
      cleanSlug,
      locale: "en",
    }).pipe(Effect.flip);
    expect(failure).toMatchObject({
      _tag: "CacheFailure",
      cause,
      owner,
    });
  });
}

/** Resolves one markdown route inside the Effect test runtime. */
function readMarkdown(cleanSlug: string, locale: Locale = "en") {
  return getLlmsMarkdownText({ cleanSlug, locale });
}

/** Verifies that one route has no body-bearing signed markdown. */
function expectNoPublishedMarkdown(cleanSlug: string) {
  return Effect.gen(function* () {
    expect(yield* readMarkdown(cleanSlug)).toBeNull();
    expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
  });
}

describe("llms markdown content resolver", () => {
  beforeEach(() => {
    mockGetCachedLlmsSectionIndexText.mockReset().mockResolvedValue(null);
    mockGetCachedPublishedText
      .mockReset()
      .mockResolvedValue("Published markdown");
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

  it.effect("reads migrated public material markdown only from Aksara", () =>
    Effect.gen(function* () {
      mockGetCachedPublishedText.mockResolvedValue("Aksara markdown");

      expect(yield* readMarkdown(PUBLISHED_PATH)).toBe("Aksara markdown");
      expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
        activeReleaseId,
        appLocale: "en",
        family: "material",
        publicPath: PUBLISHED_PATH,
      });
    })
  );

  it.effect("types cached Aksara markdown failures", () =>
    Effect.gen(function* () {
      const error = new Error("Aksara markdown failed");
      mockGetCachedPublishedText.mockRejectedValue(error);

      yield* expectCacheFailure(PUBLISHED_PATH, error, "published");
      expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reads a newly published material route without an old route row",
    () =>
      Effect.gen(function* () {
        mockReadActiveContentRoute.mockReturnValueOnce(
          Effect.succeed({ activeReleaseId, kind: "found" })
        );
        mockGetCachedPublishedText.mockResolvedValue("New markdown");

        expect(yield* readMarkdown(NEW_PATH)).toBe("New markdown");
        expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
          activeReleaseId,
          appLocale: "en",
          family: "material",
          publicPath: NEW_PATH,
        });
      })
  );

  it.effect("does not fall back after an owned material route is deleted", () =>
    Effect.gen(function* () {
      mockReadActiveContentRoute.mockReturnValueOnce(
        Effect.succeed({ activeReleaseId, kind: "missing" })
      );

      expect(yield* readMarkdown(SOURCE_PUBLIC_PATH)).toBeNull();
      expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reads an owned article body from the generic Aksara markdown seam",
    () =>
      Effect.gen(function* () {
        mockGetCachedPublishedText.mockResolvedValue("Published article");

        expect(yield* readMarkdown(PUBLISHED_ARTICLE_PATH)).toBe(
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
      })
  );

  it.effect("does not fall back after an owned article route is deleted", () =>
    Effect.gen(function* () {
      mockReadActiveContentRoute.mockReturnValueOnce(
        Effect.succeed({ activeReleaseId, kind: "missing" })
      );

      expect(yield* readMarkdown(PUBLISHED_ARTICLE_PATH)).toBeNull();
      expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
    })
  );

  it.effect("fails closed when signed material ownership is unavailable", () =>
    Effect.gen(function* () {
      mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
      mockReadActiveContentRoute.mockReturnValueOnce(
        Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
      );

      expect(yield* readMarkdown(SOURCE_PUBLIC_PATH)).toBeNull();
      expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
    })
  );

  it.effect("returns Quran markdown before checking signed content", () =>
    Effect.gen(function* () {
      mockGetQuranLlmsText.mockReturnValue(Effect.succeed("Quran markdown"));

      expect(yield* readMarkdown("quran/1")).toBe("Quran markdown");
      expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
      expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
    })
  );

  it.effect("does not invent markdown for curriculum context routes", () =>
    expectNoPublishedMarkdown(
      "curriculum/merdeka/class-12/mathematics/integral"
    )
  );

  it.effect(
    "does not invent markdown for try-out catalog routes without a source document",
    () =>
      Effect.gen(function* () {
        yield* expectNoPublishedMarkdown("try-out/indonesia/snbt");
        expect(
          yield* readMarkdown("try-out/indonesia/snbt/2027/set-1")
        ).toBeNull();
        expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reads a reviewed Page body through the same signed markdown seam",
    () =>
      Effect.gen(function* () {
        mockGetCachedPublishedText.mockResolvedValue("Signed Page markdown");

        expect(yield* readMarkdown("terms-of-service")).toBe(
          "Signed Page markdown"
        );
        expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
          activeReleaseId,
          appLocale: "en",
          family: "page",
          publicPath: PUBLISHED_PAGE_PATH,
        });
        expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reads a nested reviewed Page without assuming one route segment",
    () =>
      Effect.gen(function* () {
        mockGetCachedPublishedText.mockResolvedValue(
          "Nested signed Page markdown"
        );

        expect(yield* readMarkdown(PUBLISHED_NESTED_PAGE_PATH)).toBe(
          "Nested signed Page markdown"
        );
        expect(mockGetCachedPublishedText).toHaveBeenCalledWith({
          activeReleaseId,
          appLocale: "en",
          family: "page",
          publicPath: PUBLISHED_NESTED_PAGE_PATH,
        });
      })
  );

  it.effect(
    "returns sitemap-derived route indexes when page markdown is absent",
    () =>
      Effect.gen(function* () {
        mockGetCachedLlmsSectionIndexText.mockResolvedValue("Index markdown");

        expect(yield* readMarkdown("articles/politics")).toBe("Index markdown");
        expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
          cleanSlug: "llms/en/articles/politics",
        });
      })
  );

  it.effect("returns null when no markdown source exists", () =>
    Effect.gen(function* () {
      expect(yield* readMarkdown("articles/missing")).toBeNull();
    })
  );

  it.effect("recognizes a route owned by a public Markdown index", () =>
    Effect.gen(function* () {
      mockResolvePublicLlmsSectionIndex.mockReturnValueOnce({
        label: "Curriculum",
        prefix: "curriculum",
      });

      expect(
        yield* hasLlmsMarkdownSource({
          cleanSlug: "curriculum",
          locale: "en",
        })
      ).toBe(true);
      expect(mockClassifyQuranLlmsRoute).not.toHaveBeenCalled();
      expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
      expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
    })
  );

  it.effect.each(["", "llms"])(
    "recognizes locale index %j without reading its body",
    (cleanSlug) =>
      Effect.gen(function* () {
        mockIsPublicLlmsLocaleIndexRoute.mockReturnValueOnce(true);

        expect(yield* hasLlmsMarkdownSource({ cleanSlug, locale: "en" })).toBe(
          true
        );
        expect(mockIsPublicLlmsLocaleIndexRoute).toHaveBeenCalledWith(
          cleanSlug
        );
        expect(mockResolvePublicLlmsSectionIndex).not.toHaveBeenCalled();
        expect(mockClassifyQuranLlmsRoute).not.toHaveBeenCalled();
        expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
        expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
        expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
        expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
      })
  );

  it.effect("recognizes Quran ownership without reading its body twice", () =>
    Effect.gen(function* () {
      mockClassifyQuranLlmsRoute.mockReturnValueOnce(
        Option.some({ kind: "surah", surahNumber: 1 })
      );

      expect(
        yield* hasLlmsMarkdownSource({ cleanSlug: "quran/1", locale: "en" })
      ).toBe(true);
      expect(mockClassifyQuranLlmsRoute).toHaveBeenCalledWith("quran/1");
      expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
      expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
      expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
      expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
    })
  );

  it.effect.each([
    { cleanSlug: PUBLISHED_ARTICLE_PATH, family: "article" },
    { cleanSlug: PUBLISHED_PATH, family: "material" },
    { cleanSlug: PUBLISHED_PAGE_PATH, family: "page" },
  ])(
    "recognizes an owned $family without reading its body",
    ({ cleanSlug, family }) =>
      Effect.gen(function* () {
        expect(yield* hasLlmsMarkdownSource({ cleanSlug, locale: "en" })).toBe(
          true
        );
        expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
          activeReleaseId,
          appLocale: "en",
          family,
          publicPath: cleanSlug,
        });
        expect(mockGetQuranLlmsText).not.toHaveBeenCalled();
        expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
        expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reports availability only when the real source chain returns text",
    () =>
      Effect.gen(function* () {
        mockGetCachedLlmsSectionIndexText
          .mockResolvedValueOnce("Index markdown")
          .mockResolvedValueOnce(null);

        expect(
          yield* hasLlmsMarkdownSource({
            cleanSlug: "articles/politics",
            locale: "en",
          })
        ).toBe(true);
        expect(
          yield* hasLlmsMarkdownSource({ cleanSlug: "search", locale: "en" })
        ).toBe(false);
      })
  );

  it.effect(
    "treats invalid projected markdown paths as unsupported content",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readMarkdown("subjects/mathematics/integral/invalid.segment")
        ).toBeNull();
        expect(mockGetCachedPublishedText).not.toHaveBeenCalled();
        expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
          activeReleaseId,
          appLocale: "en",
          family: "material",
          publicPath: "subjects/mathematics/integral/invalid.segment",
        });
      })
  );

  it.effect(
    "treats the empty markdown slug as an unsupported route index",
    () =>
      Effect.gen(function* () {
        expect(yield* readMarkdown("")).toBeNull();
        expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
          cleanSlug: "llms/en/",
        });
      })
  );

  it.effect("types cached section-index failures", () => {
    const error = new Error("index failed");
    mockGetCachedLlmsSectionIndexText.mockRejectedValue(error);

    return expectCacheFailure("articles/missing", error, "index");
  });

  it.effect("surfaces active material-route lookup failures", () =>
    Effect.gen(function* () {
      const error = new Error("active route lookup failed");
      mockReadActiveContentRoute.mockReturnValueOnce(Effect.fail(error));

      expect(yield* readMarkdown(PUBLISHED_PATH).pipe(Effect.flip)).toBe(error);
    })
  );
});
