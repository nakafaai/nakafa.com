// @vitest-environment node

import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedPageCatalog,
  readPublishedPageCatalog,
  readPublishedPageLocalePath,
  verifyPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import { testPageProjection } from "@/test/content-page";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-pages");
const idPageProjection = {
  ...testPageProjection,
  appLocale: AppLocaleSchema.make("id"),
  artifactLocale: ArtifactLocaleSchema.make("id"),
  publicPath: PublicPathSchema.make("ketentuan-penggunaan"),
};
const dePageProjection = {
  ...testPageProjection,
  appLocale: AppLocaleSchema.make("de"),
  artifactLocale: ArtifactLocaleSchema.make("de"),
  publicPath: PublicPathSchema.make("nutzungsbedingungen"),
};

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeQueryMock,
}));

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));

describe("published Page catalog", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    runtimeQueryMock.mockReset().mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        managed: true,
        projectionJson: [JSON.stringify(testPageProjection)],
      })
    );
  });

  it("decodes every verified Page projection with its release pin", async () => {
    await expect(
      Effect.runPromise(readPublishedPageCatalog())
    ).resolves.toEqual({
      activeReleaseId,
      projections: [testPageProjection],
    });
  });

  it("caches the complete signed Page catalog", async () => {
    await expect(getPublishedPageCatalog()).resolves.toEqual({
      activeReleaseId,
      projections: [testPageProjection],
    });
    expect(cacheMock).toHaveBeenCalledWith("page");
  });

  it.each([
    ["unmanaged", { activeReleaseId, managed: false, projectionJson: [] }],
    [
      "missing release",
      { activeReleaseId: null, managed: true, projectionJson: [] },
    ],
  ])("rejects an %s Page catalog", async (_label, result) => {
    runtimeQueryMock.mockReturnValueOnce(Effect.succeed(result));

    await expect(
      Effect.runPromise(readPublishedPageCatalog().pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      publicPath: "pages",
    });
  });

  it("rejects malformed Page projection JSON", async () => {
    runtimeQueryMock.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId,
        managed: true,
        projectionJson: ["{"],
      })
    );

    await expect(
      Effect.runPromise(readPublishedPageCatalog().pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      publicPath: "pages",
    });
  });

  it("verifies the exact runtime Page against its localized catalog", async () => {
    const catalog = {
      activeReleaseId,
      projections: [testPageProjection],
    };
    await expect(
      Effect.runPromise(
        verifyPublishedPageCatalog(catalog, {
          activeReleaseId,
          projection: testPageProjection,
        })
      )
    ).resolves.toEqual([testPageProjection]);

    await expect(
      Effect.runPromise(
        verifyPublishedPageCatalog(catalog, {
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          projection: testPageProjection,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
    });
    await expect(
      Effect.runPromise(
        verifyPublishedPageCatalog(catalog, {
          activeReleaseId,
          projection: {
            ...testPageProjection,
            publicPath: PublicPathSchema.make("other-page"),
          },
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      publicPath: "other-page",
    });
  });

  it("resolves signed locale counterparts without a route map", async () => {
    runtimeQueryMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        managed: true,
        projectionJson: [
          testPageProjection,
          idPageProjection,
          dePageProjection,
        ].map((projection) => JSON.stringify(projection)),
      })
    );

    await expect(
      Effect.runPromise(
        readPublishedPageLocalePath({
          currentLocale: "en",
          locale: "de",
          publicPath: "terms-of-service",
        })
      )
    ).resolves.toEqual({
      kind: "found",
      publicPath: "nutzungsbedingungen",
    });
    await expect(
      Effect.runPromise(
        readPublishedPageLocalePath({
          currentLocale: "en",
          locale: "de",
          publicPath: "other-page",
        })
      )
    ).resolves.toEqual({ kind: "unmanaged" });

    runtimeQueryMock.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId,
        managed: true,
        projectionJson: [JSON.stringify(testPageProjection)],
      })
    );
    await expect(
      Effect.runPromise(
        readPublishedPageLocalePath({
          currentLocale: "en",
          locale: "de",
          publicPath: "terms-of-service",
        })
      )
    ).resolves.toEqual({ kind: "missing" });
  });
});
