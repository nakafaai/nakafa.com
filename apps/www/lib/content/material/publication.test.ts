// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { previewArtifactHash, previewProjection } from "@/test/content-preview";

const catalogCacheMock = vi.hoisted(() => vi.fn());
const contentCacheMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const routeMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: catalogCacheMock,
  applyPublishedContentCache: contentCacheMock,
}));
vi.mock("@/lib/content/material/route", () => ({
  getPublishedMaterialRoute: routeMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  renderPublishedMaterial: renderMock,
}));

beforeEach(() => {
  catalogCacheMock.mockReset();
  contentCacheMock.mockReset();
  renderMock.mockReset();
  routeMock.mockReset();
});

describe("material publication", () => {
  it("returns a signed missing route without rendering an application error", async () => {
    routeMock.mockResolvedValueOnce({ activeReleaseId, projection: null });
    renderMock.mockRejectedValueOnce(
      new ContentRuntimeMissingError({
        request: {
          delivery: "public",
          locale: "en",
          publicPath: previewProjection.publicPath,
        },
      })
    );

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).resolves.toBeNull();
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects a missing body when the signed route still exists", async () => {
    routeMock.mockResolvedValueOnce({
      activeReleaseId,
      projection: previewProjection,
    });
    renderMock.mockRejectedValueOnce(
      new ContentRuntimeMissingError({
        request: {
          delivery: "public",
          locale: "en",
          publicPath: previewProjection.publicPath,
        },
      })
    );

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).rejects.toHaveProperty("name", "(FiberFailure) PublishedProjectionError");
  });

  it("verifies and caches one coherent material publication", async () => {
    const model = {
      activeReleaseId,
      projection: previewProjection,
    };
    const published = {
      activeReleaseId,
      artifactHash: previewArtifactHash,
      projection: previewProjection,
    };
    routeMock.mockResolvedValueOnce(model);
    renderMock.mockResolvedValueOnce(published);

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).resolves.toEqual({ model, published });
    expect(catalogCacheMock).not.toHaveBeenCalled();
    expect(contentCacheMock).toHaveBeenCalledWith(
      "material",
      previewArtifactHash
    );
  });
});
