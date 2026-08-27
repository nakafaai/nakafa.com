// @vitest-environment node

import {
  PublicPathSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  previewArtifactHash,
  previewDeProjection,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
  previewSourcePath,
} from "@/test/content-preview";

const catalogCacheMock = vi.hoisted(() => vi.fn());
const contentCacheMock = vi.hoisted(() => vi.fn());
const routeMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeManifestHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const activeReleaseId = ReleaseIdSchema.make("release-material");
const model = {
  activeManifestHash,
  activeReleaseId,
  alternates: [previewProjection, previewIdProjection, previewDeProjection],
  projection: previewProjection,
  rendererDomain: "mathematics",
  siblings: [previewProjection, previewNextProjection],
  sourcePath: previewSourcePath,
  sourceRevision: "a".repeat(40),
};
const published = {
  activeReleaseId,
  artifactHash: previewArtifactHash,
  projection: previewProjection,
  rendererDomain: "mathematics",
};

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: catalogCacheMock,
  applyPublishedContentCache: contentCacheMock,
}));
vi.mock("@/lib/content/material/route", () => ({
  getPublishedMaterialRoute: routeMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readRenderedMaterial: renderMock,
}));

function missingRuntime(publicPath: typeof PublicPathSchema.Type) {
  return new ContentRuntimeMissingError({
    request: {
      appLocale: previewProjection.appLocale,
      delivery: "public",
      publicPath,
    },
  });
}

beforeEach(() => {
  catalogCacheMock.mockReset();
  contentCacheMock.mockReset();
  routeMock.mockReset();
  renderMock.mockReset();
  routeMock.mockResolvedValue(model);
  renderMock.mockReturnValue(Effect.succeed(published));
});

describe("material publication", () => {
  it("starts one bounded route and one signed body before either settles", async () => {
    let releaseRoute: () => void = () => undefined;
    let releasePublished: () => void = () => undefined;
    routeMock.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseRoute = () => resolve(model);
      })
    );
    renderMock.mockReturnValueOnce(
      Effect.promise(
        () =>
          new Promise((resolve) => {
            releasePublished = () => resolve(published);
          })
      )
    );

    const publication = getMaterialPublication(
      "en",
      previewProjection.publicPath
    );
    await vi.waitFor(() => {
      expect(routeMock).toHaveBeenCalledOnce();
      expect(routeMock).toHaveBeenCalledWith(
        "en",
        previewProjection.publicPath
      );
      expect(renderMock).toHaveBeenCalledOnce();
    });
    releaseRoute();
    releasePublished();

    await expect(publication).resolves.toMatchObject({ model, published });
  });

  it("returns null only when both authenticated owners report a missing route", async () => {
    const publicPath = PublicPathSchema.make(
      `${previewProjection.publicPath}-missing`
    );
    routeMock.mockResolvedValueOnce({
      ...model,
      alternates: [],
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourcePath: null,
    });
    renderMock.mockReturnValueOnce(Effect.fail(missingRuntime(publicPath)));

    await expect(getMaterialPublication("en", publicPath)).resolves.toBeNull();
    expect(routeMock).toHaveBeenCalledOnce();
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects a missing body when the bounded route still exists", async () => {
    renderMock.mockReturnValueOnce(
      Effect.fail(missingRuntime(previewProjection.publicPath))
    );

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: previewProjection.appLocale,
      publicPath: previewProjection.publicPath,
    });
  });

  it("rejects a signed body when the bounded route is missing", async () => {
    const publicPath = PublicPathSchema.make(
      `${previewProjection.publicPath}-missing`
    );
    routeMock.mockResolvedValueOnce({
      ...model,
      alternates: [],
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourcePath: null,
    });

    await expect(
      getMaterialPublication("en", publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: previewProjection.appLocale,
      publicPath,
    });
  });

  it("verifies and caches one coherent material publication", async () => {
    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).resolves.toEqual({ model, published });
    expect(routeMock).toHaveBeenCalledOnce();
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).toHaveBeenCalledWith(
      "material",
      previewArtifactHash
    );
  });

  it("preserves route failure provenance across the cache boundary", async () => {
    const failure = new PublishedProjectionError({
      appLocale: previewProjection.appLocale,
      publicPath: previewProjection.publicPath,
    });
    routeMock.mockRejectedValueOnce(failure);

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).rejects.toMatchObject({
      _tag: "MaterialRouteReadError",
      appLocale: previewProjection.appLocale,
      cause: failure,
      publicPath: previewProjection.publicPath,
    });
  });

  it("interrupts the signed body read when the bounded route fails", async () => {
    const interrupted = vi.fn();
    const failure = new PublishedProjectionError({
      appLocale: previewProjection.appLocale,
      publicPath: previewProjection.publicPath,
    });
    routeMock.mockRejectedValueOnce(failure);
    renderMock.mockReturnValueOnce(
      Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted)))
    );

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).rejects.toMatchObject({
      _tag: "MaterialRouteReadError",
      cause: failure,
    });
    expect(interrupted).toHaveBeenCalledOnce();
  });
});
