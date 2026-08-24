// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArticlePublication } from "@/lib/content/article/publication";
import {
  testArticleArtifact,
  testArticleProjection,
} from "@/test/content-article";

const catalogCacheMock = vi.hoisted(() => vi.fn());
const contentCacheMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const routeMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: catalogCacheMock,
  applyPublishedContentCache: contentCacheMock,
}));
vi.mock("@/lib/content/article/route", () => ({
  getPublishedArticleRoute: routeMock,
}));
vi.mock("@/lib/content/published/article", () => ({
  renderCurrentPublishedArticle: renderMock,
}));

beforeEach(() => {
  catalogCacheMock.mockReset();
  contentCacheMock.mockReset();
  renderMock.mockReset();
  routeMock.mockReset();
});

describe("article publication", () => {
  it("returns a signed missing route without rendering an application error", async () => {
    routeMock.mockResolvedValueOnce({ activeReleaseId, projection: null });
    renderMock.mockRejectedValueOnce(
      new ContentRuntimeMissingError({
        request: {
          appLocale: testArticleProjection.appLocale,
          delivery: "public",
          publicPath: testArticleProjection.publicPath,
        },
      })
    );

    await expect(
      getArticlePublication("en", testArticleProjection.publicPath)
    ).resolves.toBeNull();
    expect(catalogCacheMock).toHaveBeenCalledWith("article");
    expect(contentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects a missing body when the signed route still exists", async () => {
    routeMock.mockResolvedValueOnce({
      activeReleaseId,
      projection: testArticleProjection,
    });
    renderMock.mockRejectedValueOnce(
      new ContentRuntimeMissingError({
        request: {
          appLocale: testArticleProjection.appLocale,
          delivery: "public",
          publicPath: testArticleProjection.publicPath,
        },
      })
    );

    await expect(
      getArticlePublication("en", testArticleProjection.publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: testArticleProjection.appLocale,
      publicPath: testArticleProjection.publicPath,
    });
  });

  it("verifies and caches one coherent article publication", async () => {
    const model = {
      activeReleaseId,
      projection: testArticleProjection,
    };
    const published = {
      activeReleaseId,
      artifactHash: testArticleArtifact.artifactHash,
      projection: testArticleProjection,
    };
    routeMock.mockResolvedValueOnce(model);
    renderMock.mockResolvedValueOnce(published);

    await expect(
      getArticlePublication("en", testArticleProjection.publicPath)
    ).resolves.toEqual({ model, published });
    expect(catalogCacheMock).not.toHaveBeenCalled();
    expect(contentCacheMock).toHaveBeenCalledWith(
      "article",
      testArticleArtifact.artifactHash
    );
  });
});
