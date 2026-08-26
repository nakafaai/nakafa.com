// @vitest-environment node

import {
  ContentKeySchema,
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  type ActiveAppLocaleList,
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Cause, Effect } from "effect";
import type { Locale } from "next-intl";
import { vi } from "vitest";
import type {
  PublishedMaterialCatalog,
  PublishedMaterialRelease,
} from "@/lib/content/material/catalog";
import {
  getMaterialCatalogRoute,
  getMaterialPublication,
  readMaterialCatalogRoute,
} from "@/lib/content/material/publication";
import {
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
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
const releaseMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeManifestHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const activeReleaseId = ReleaseIdSchema.make("release-material");
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
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
vi.mock("@/lib/content/material/catalog", () => ({
  getPublishedMaterialRelease: releaseMock,
  getPublishedMaterialRoutes: catalogMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readRenderedMaterial: renderMock,
}));

function materialCatalog(
  appLocale: AppLocale,
  routes: readonly MaterialLessonProjection[],
  releaseId = activeReleaseId,
  revision: PublishedMaterialCatalog["sourceRevision"] = sourceRevision
): PublishedMaterialCatalog {
  return {
    activeManifestHash,
    activeReleaseId: releaseId,
    appLocale,
    routes,
    sourceRevision: revision,
  };
}
function materialRelease(
  activeAppLocales: ActiveAppLocaleList = ACTIVE_APP_LOCALES
): PublishedMaterialRelease {
  return {
    activeAppLocales,
    activeManifestHash,
    activeReleaseId,
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
function mockCatalogReads(source = catalogs) {
  catalogMock.mockImplementation((locale: AppLocale) =>
    Promise.resolve(source.find((catalog) => catalog.appLocale === locale))
  );
}

function readCatalogRoute(
  source: readonly PublishedMaterialCatalog[],
  release = materialRelease(),
  locale: Locale = "en",
  publicPath = previewProjection.publicPath
) {
  return readMaterialCatalogRoute(release, source, locale, publicPath);
}

beforeEach(() => {
  catalogCacheMock.mockReset();
  catalogMock.mockReset();
  contentCacheMock.mockReset();
  releaseMock.mockReset();
  renderMock.mockReset();
  releaseMock.mockResolvedValue(materialRelease());
  mockCatalogReads();
});

describe("material publication", () => {
  it("starts every catalog and the signed body before either owner settles", async () => {
    const catalogReleases: Array<() => void> = [];
    catalogMock.mockImplementation(
      (locale: AppLocale) =>
        new Promise((resolve) => {
          const catalog = catalogs.find(
            (candidate) => candidate.appLocale === locale
          );
          catalogReleases.push(() => resolve(catalog));
        })
    );
    let releasePublished: () => void = () => undefined;
    renderMock.mockReturnValue(
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
      expect(catalogMock).toHaveBeenCalledTimes(3);
      expect(releaseMock).toHaveBeenCalledOnce();
      expect(renderMock).toHaveBeenCalledOnce();
    });
    for (const releaseCatalog of catalogReleases) {
      releaseCatalog();
    }
    releasePublished();

    await expect(publication).resolves.toMatchObject({ published });
  });

  it("returns a release-bound missing route without rendering an application error", async () => {
    const publicPath = PublicPathSchema.make(
      `${previewProjection.publicPath}-missing`
    );
    renderMock.mockReturnValueOnce(
      Effect.fail(
        new ContentRuntimeMissingError({
          request: {
            appLocale: previewProjection.appLocale,
            delivery: "public",
            publicPath,
          },
        })
      )
    );

    await expect(getMaterialPublication("en", publicPath)).resolves.toBeNull();
    expect(catalogMock).toHaveBeenCalledTimes(3);
    expect(catalogCacheMock).toHaveBeenCalledOnce();
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).not.toHaveBeenCalled();
  });

  it("rejects a missing body when the signed catalog route still exists", async () => {
    renderMock.mockReturnValueOnce(
      Effect.fail(
        new ContentRuntimeMissingError({
          request: {
            appLocale: previewProjection.appLocale,
            delivery: "public",
            publicPath: previewProjection.publicPath,
          },
        })
      )
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
    renderMock.mockReturnValueOnce(Effect.succeed(published));

    await expect(
      getMaterialPublication("en", publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: previewProjection.appLocale,
      publicPath,
    });
  });

  it("verifies and caches one coherent material publication", async () => {
    renderMock.mockReturnValueOnce(Effect.succeed(published));

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
        sourceRevision,
      },
      published,
    });
    expect(catalogCacheMock).toHaveBeenCalledOnce();
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).toHaveBeenCalledWith(
      "material",
      previewArtifactHash
    );
  });

  it("reads metadata from catalogs without evaluating the signed body", async () => {
    await expect(
      getMaterialCatalogRoute("en", previewProjection.publicPath)
    ).resolves.toMatchObject({ projection: previewProjection });

    expect(renderMock).not.toHaveBeenCalled();
    expect(catalogCacheMock).toHaveBeenCalledWith("material");
    expect(contentCacheMock).not.toHaveBeenCalled();
  });

  it.each([
    new NakafaAgentDataReadError({ message: "Catalog unavailable." }),
    new PublishedProjectionError({
      appLocale: previewProjection.appLocale,
      publicPath: previewProjection.publicPath,
    }),
    new PublishedReleaseMismatchError({
      actualReleaseId: ReleaseIdSchema.make("release-other"),
      expectedReleaseId: activeReleaseId,
    }),
  ])(
    "preserves typed failures across cached Promise boundaries",
    async (failure) => {
      releaseMock.mockRejectedValueOnce(failure);

      await expect(
        getMaterialCatalogRoute("en", previewProjection.publicPath)
      ).rejects.toBe(failure);
    }
  );

  it("maps unknown cached Promise failures explicitly", async () => {
    releaseMock.mockRejectedValueOnce("unexpected");

    await expect(
      getMaterialCatalogRoute("en", previewProjection.publicPath)
    ).rejects.toSatisfy(Cause.isUnknownError);
  });

  it.effect("uses only signed active locale membership", () =>
    Effect.gen(function* () {
      const release = materialRelease([
        AppLocaleSchema.make("en"),
        AppLocaleSchema.make("id"),
      ]);
      const subsetCatalogs = [
        catalogs[0],
        catalogs[1],
        materialCatalog(previewDeProjection.appLocale, []),
      ];
      const route = yield* readCatalogRoute(subsetCatalogs, release);
      expect(route.alternates).toEqual([
        previewProjection,
        previewIdProjection,
      ]);
      expect(
        yield* readCatalogRoute(
          subsetCatalogs,
          release,
          "de",
          previewDeProjection.publicPath
        )
      ).toMatchObject({ projection: null });

      const invalidInactiveCatalog = [
        subsetCatalogs[0],
        subsetCatalogs[1],
        catalogs[2],
      ];
      expect(
        yield* readCatalogRoute(invalidInactiveCatalog, release).pipe(
          Effect.flip
        )
      ).toBeInstanceOf(PublishedProjectionError);
    })
  );

  it.effect("preserves bounded coherent sibling ordering", () =>
    Effect.gen(function* () {
      const sameOrderNext = {
        ...previewNextProjection,
        order: previewProjection.order,
      };
      const reversedCatalogs = [
        materialCatalog(previewProjection.appLocale, [
          sameOrderNext,
          previewProjection,
        ]),
        catalogs[1],
        catalogs[2],
      ];
      const route = yield* readCatalogRoute(reversedCatalogs);
      expect(route.siblings).toEqual([previewProjection, sameOrderNext]);

      const splitSibling = {
        ...previewNextProjection,
        contentKey: ContentKeySchema.make("test:split-sibling"),
        parentPath: PublicPathSchema.make("subjects/mathematics/other-topic"),
      };
      const oversizedGroup = Array.from(
        { length: MATERIAL_GROUP_LIMIT },
        (_, index) => ({
          ...previewNextProjection,
          contentKey: ContentKeySchema.make(`test:oversized-${index}`),
          order: index + 6,
          publicPath: PublicPathSchema.make(
            `${previewProjection.parentPath}/oversized-${index}`
          ),
        })
      );
      for (const routes of [
        [previewProjection, splitSibling],
        [previewProjection, ...oversizedGroup],
      ]) {
        const malformed = [
          materialCatalog(previewProjection.appLocale, routes),
          catalogs[1],
          catalogs[2],
        ];
        expect(
          yield* readCatalogRoute(malformed).pipe(Effect.flip)
        ).toBeInstanceOf(PublishedProjectionError);
      }
    })
  );

  it.effect("rejects catalogs from different active releases", () =>
    Effect.gen(function* () {
      const mismatched = [
        catalogs[0],
        materialCatalog(
          previewIdProjection.appLocale,
          [previewIdProjection],
          ReleaseIdSchema.make("release-other")
        ),
        catalogs[2],
      ];

      expect(
        yield* readCatalogRoute(mismatched).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedReleaseMismatchError" });
    })
  );

  it.effect("rejects catalogs from different source revisions", () =>
    Effect.gen(function* () {
      for (const revision of [GitCommitShaSchema.make("b".repeat(40)), null]) {
        const mismatched = [
          catalogs[0],
          materialCatalog(
            previewIdProjection.appLocale,
            [previewIdProjection],
            activeReleaseId,
            revision
          ),
          catalogs[2],
        ];
        expect(
          yield* readCatalogRoute(mismatched).pipe(Effect.flip)
        ).toMatchObject({ _tag: "PublishedProjectionError" });
      }
    })
  );

  it.effect("rejects malformed catalog ownership", () =>
    Effect.gen(function* () {
      const otherManifestHash = Sha256HashSchema.make(
        `sha256:${"b".repeat(64)}`
      );
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
        expect(yield* readCatalogRoute(source).pipe(Effect.flip)).toMatchObject(
          { _tag: "PublishedProjectionError" }
        );
      }
    })
  );

  it.effect("rejects incomplete locale and counterpart ownership", () =>
    Effect.gen(function* () {
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
        expect(yield* readCatalogRoute(source).pipe(Effect.flip)).toMatchObject(
          { _tag: "PublishedProjectionError" }
        );
      }

      expect(
        yield* readCatalogRoute(
          missingLocale,
          materialRelease(),
          "de",
          previewDeProjection.publicPath
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
