// @vitest-environment node

import {
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedMaterialCatalog } from "@/lib/content/material/catalog";
import {
  getMaterialPublication,
  readMaterialCatalogRoute,
} from "@/lib/content/material/publication";
import {
  previewArtifactHash,
  previewDeProjection,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const catalogCacheMock = vi.hoisted(() => vi.fn());
const catalogMock = vi.hoisted(() => vi.fn());
const contentCacheMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeManifestHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const activeReleaseId = ReleaseIdSchema.make("release-material");
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: catalogCacheMock,
  applyPublishedContentCache: contentCacheMock,
}));
vi.mock("@/lib/content/material/catalog", () => ({
  getPublishedMaterialRoutes: catalogMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  renderPublishedMaterial: renderMock,
}));

/** Builds one decoded locale catalog under the selected release identity. */
function materialCatalog(
  appLocale: AppLocale,
  routes: readonly MaterialLessonProjection[],
  releaseId = activeReleaseId
): PublishedMaterialCatalog {
  return {
    activeManifestHash,
    activeReleaseId: releaseId,
    appLocale,
    routes,
    sourceRevision,
  };
}

const catalogs = [
  materialCatalog(previewProjection.appLocale, [
    previewProjection,
    previewNextProjection,
  ]),
  materialCatalog(previewIdProjection.appLocale, [previewIdProjection]),
  materialCatalog(previewDeProjection.appLocale, [previewDeProjection]),
];

/** Resolves the matching low-cardinality catalog for every locale read. */
function mockCatalogReads(source = catalogs) {
  catalogMock.mockImplementation((locale: AppLocale) =>
    Promise.resolve(source.find((catalog) => catalog.appLocale === locale))
  );
}

beforeEach(() => {
  catalogCacheMock.mockReset();
  catalogMock.mockReset();
  contentCacheMock.mockReset();
  renderMock.mockReset();
  mockCatalogReads();
});

describe("material publication", () => {
  it("returns a release-bound missing route without rendering an application error", async () => {
    const publicPath = PublicPathSchema.make(
      `${previewProjection.publicPath}-missing`
    );
    renderMock.mockRejectedValueOnce(
      new ContentRuntimeMissingError({
        request: {
          appLocale: previewProjection.appLocale,
          delivery: "public",
          publicPath,
        },
      })
    );

    await expect(getMaterialPublication("en", publicPath)).resolves.toBeNull();
    expect(catalogMock).toHaveBeenCalledTimes(3);
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects a missing body when the signed catalog route still exists", async () => {
    renderMock.mockRejectedValueOnce(
      new ContentRuntimeMissingError({
        request: {
          appLocale: previewProjection.appLocale,
          delivery: "public",
          publicPath: previewProjection.publicPath,
        },
      })
    );

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: previewProjection.appLocale,
      publicPath: previewProjection.publicPath,
    });
  });

  it("rejects a signed body that has no matching catalog route", async () => {
    const publicPath = PublicPathSchema.make(
      `${previewProjection.publicPath}-missing`
    );
    renderMock.mockResolvedValueOnce({
      activeReleaseId,
      artifactHash: previewArtifactHash,
      projection: previewProjection,
      rendererDomain: "mathematics",
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
    const published = {
      activeReleaseId,
      artifactHash: previewArtifactHash,
      projection: previewProjection,
      rendererDomain: "mathematics",
    };
    renderMock.mockResolvedValueOnce(published);

    await expect(
      getMaterialPublication("en", previewProjection.publicPath)
    ).resolves.toEqual({
      model: {
        activeManifestHash,
        activeReleaseId,
        alternates: [
          previewProjection,
          previewIdProjection,
          previewDeProjection,
        ],
        projection: previewProjection,
        siblings: [previewProjection, previewNextProjection],
      },
      published,
    });
    expect(catalogCacheMock).not.toHaveBeenCalled();
    expect(contentCacheMock).toHaveBeenCalledWith(
      "material",
      previewArtifactHash
    );
  });

  it("rejects catalogs from different active releases", async () => {
    const mismatched = [
      catalogs[0],
      materialCatalog(
        previewIdProjection.appLocale,
        [previewIdProjection],
        ReleaseIdSchema.make("release-other")
      ),
      catalogs[2],
    ];

    await expect(
      Effect.runPromise(
        readMaterialCatalogRoute(
          mismatched,
          "en",
          previewProjection.publicPath
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedReleaseMismatchError" });
  });

  it("rejects malformed catalog ownership", async () => {
    const otherManifestHash = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
    const malformedCatalogs = [
      [
        catalogs[0],
        { ...catalogs[1], activeManifestHash: otherManifestHash },
        catalogs[2],
      ],
      [
        materialCatalog(previewProjection.appLocale, [
          previewProjection,
          previewProjection,
        ]),
        catalogs[1],
        catalogs[2],
      ],
      [
        materialCatalog(previewProjection.appLocale, [previewIdProjection]),
        catalogs[1],
        catalogs[2],
      ],
    ];

    for (const source of malformedCatalogs) {
      await expect(
        Effect.runPromise(
          readMaterialCatalogRoute(
            source,
            "en",
            previewProjection.publicPath
          ).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    }
  });

  it("rejects incomplete locale and counterpart ownership", async () => {
    const missingLocale = catalogs.slice(0, 2);
    const duplicateLocale = [catalogs[0], catalogs[0], catalogs[2]];
    const duplicateCounterpart = {
      ...previewIdProjection,
      publicPath: PublicPathSchema.make(
        `${previewIdProjection.parentPath}/duplicate-counterpart`
      ),
    };
    const missingCounterpart = [
      catalogs[0],
      materialCatalog(previewIdProjection.appLocale, []),
      catalogs[2],
    ];
    const ambiguousCounterpart = [
      catalogs[0],
      materialCatalog(previewIdProjection.appLocale, [
        previewIdProjection,
        duplicateCounterpart,
      ]),
      catalogs[2],
    ];

    for (const source of [
      missingLocale,
      duplicateLocale,
      missingCounterpart,
      ambiguousCounterpart,
    ]) {
      await expect(
        Effect.runPromise(
          readMaterialCatalogRoute(
            source,
            "en",
            previewProjection.publicPath
          ).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    }

    await expect(
      Effect.runPromise(
        readMaterialCatalogRoute(
          missingLocale,
          "de",
          previewDeProjection.publicPath
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
