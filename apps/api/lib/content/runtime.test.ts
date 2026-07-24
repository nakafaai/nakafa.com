import { ContentTransportError } from "@repo/backend/client/content/errors";
import { readPublicContent } from "@repo/backend/client/content/read";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getApiContentRouteByContentId,
  getApiPublishedContent,
  getQuranApiSurahPage,
  parseApiContentId,
  parseApiLocale,
} from "@/lib/content/runtime";

const runtimeClientMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));
const publicContentMocks = vi.hoisted(() => ({
  readPublicContent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/client/content/read", () => ({
  readPublicContent: publicContentMocks.readPublicContent,
}));
vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeClientMocks.fetchConvexRuntimeQuery,
}));

const sourceRevision = "a".repeat(40);
const articleContent = {
  activeReleaseId: "release-article",
  artifact: {
    artifactHash: `sha256:${"b".repeat(64)}`,
    payload: {
      compiledCode: "return {}",
      rawMdx: "# Signed article",
    },
    signature: "private-signature",
  },
  projection: {
    kind: "article",
    locale: "en",
    metadata: { title: "Signed article" },
    publicPath: "articles/politics/signed-article",
  },
  release: {
    manifest: {
      origin: { kind: "git", sha: sourceRevision },
    },
  },
  sourcePath: "packages/corpus/articles/politics/signed/article/en.mdx",
};

describe("API content runtime", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("narrows supported route locales", () => {
    for (const locale of locales) {
      expect(parseApiLocale(locale)).toBe(locale);
    }

    expect(parseApiLocale("fr")).toBeNull();
  });

  it("narrows graph-backed content IDs", () => {
    expect(parseApiContentId("asset:en:article:politics:article:a")).toBe(
      "asset:en:article:politics:article:a"
    );
    expect(parseApiContentId("en/articles/a")).toBeNull();
  });

  it("returns only safe fields from one exact signed body", async () => {
    publicContentMocks.readPublicContent.mockReturnValue(
      Effect.succeed(articleContent)
    );

    const result = await Effect.runPromise(
      getApiPublishedContent({
        expected: "article",
        locale: "en",
        publicPath: "articles/politics/signed-article",
      })
    );

    expect(result).toEqual({
      artifactHash: articleContent.artifact.artifactHash,
      projection: articleContent.projection,
      raw: "# Signed article",
      releaseId: "release-article",
      sourcePath: articleContent.sourcePath,
      sourceRevision,
    });
    expect(result).not.toHaveProperty("compiledCode");
    expect(result).not.toHaveProperty("signature");
    expect(readPublicContent).toHaveBeenCalledWith(
      {
        siteUrl: "https://test.convex.site",
        token: "test-runtime-token",
      },
      {
        locale: "en",
        publicPath: "articles/politics/signed-article",
      }
    );
  });

  it("rejects a signed projection from another route family", async () => {
    publicContentMocks.readPublicContent.mockReturnValue(
      Effect.succeed({
        ...articleContent,
        projection: {
          ...articleContent.projection,
          kind: "subject-lesson",
        },
      })
    );

    await expect(
      Effect.runPromise(
        getApiPublishedContent({
          expected: "article",
          locale: "en",
          publicPath: "articles/politics/signed-article",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "ApiContentFamilyError",
      actual: "subject-lesson",
      expected: "article",
    });
  });

  it("omits immutable Git provenance for rollback releases", async () => {
    publicContentMocks.readPublicContent.mockReturnValue(
      Effect.succeed({
        ...articleContent,
        release: {
          manifest: {
            origin: {
              kind: "rollback",
              releaseId: "release-previous",
            },
          },
        },
      })
    );

    await expect(
      Effect.runPromise(
        getApiPublishedContent({
          expected: "article",
          locale: "en",
          publicPath: "articles/politics/signed-article",
        })
      )
    ).resolves.toMatchObject({ sourceRevision: null });
  });

  it("preserves signed transport failures", async () => {
    const failure = new ContentTransportError({ reason: "fetch" });
    publicContentMocks.readPublicContent.mockReturnValue(Effect.fail(failure));

    await expect(
      Effect.runPromise(
        getApiPublishedContent({
          expected: "article",
          locale: "en",
          publicPath: "articles/politics/signed-article",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "ContentTransportError",
      reason: "fetch",
    });
  });

  it("reads Quran and graph routes from their bounded runtime queries", async () => {
    const quranSurahPage = { surah: { number: 1 }, verses: [] };
    const routeRow = { content_id: "asset:en:article:politics:article:a" };
    runtimeClientMocks.fetchConvexRuntimeQuery
      .mockResolvedValueOnce(quranSurahPage)
      .mockResolvedValueOnce(routeRow);

    await expect(
      Effect.runPromise(getQuranApiSurahPage({ surah: 1 }))
    ).resolves.toEqual(quranSurahPage);
    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({
          contentId: "asset:en:article:politics:article:a",
        })
      )
    ).resolves.toEqual(routeRow);
  });

  it("wraps bounded runtime query failures with operation context", async () => {
    runtimeClientMocks.fetchConvexRuntimeQuery.mockRejectedValueOnce(
      new Error("offline")
    );

    await expect(
      Effect.runPromise(getQuranApiSurahPage({ surah: 1 }).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "ApiContentRuntimeReadError",
      message: "Unable to read API content runtime query: getQuranSurahPage.",
    });
  });
});
