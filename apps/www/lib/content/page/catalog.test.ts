// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  createTestPublication,
  makePageRuntimeSource,
  TEST_PUBLICATION_RELEASE,
} from "@repo/backend/test/content/publication";
import { Effect } from "effect";
import {
  getPublishedPageCatalog,
  readPublishedPageCatalog,
  readPublishedPageLocalePath,
  verifyPublishedPageCatalog,
} from "@/lib/content/page/catalog";
import { testPageProjection } from "@/test/content-page";
import { createTestNativeQuery } from "@/test/runtime-query";

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

vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: runtimeQueryMock,
}));

vi.mock("@/lib/content/cache", () => ({
  applyContentCache: cacheMock,
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

  it.effect(
    "reads the inherited Page and active release identity from authenticated snapshot rows",
    () =>
      Effect.gen(function* () {
        const locales = ACTIVE_APP_LOCALE_CODES.map(makePageRuntimeSource);
        const fixture = locales[0];
        for (const table of [
          "contentHeads",
          "contentBindings",
          "contentArtifacts",
          "contentKeys",
        ] as const) {
          fixture.source.set(
            table,
            locales.flatMap(({ source }) => source.get(table) ?? [])
          );
        }
        fixture.source.set("contentReleases", [
          {
            ...fixture.release,
            resultFamilies: TEST_PUBLICATION_RELEASE.manifest.scope.families,
          },
        ]);
        const context = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(createTestNativeQuery(context));

        expect(yield* readPublishedPageCatalog()).toEqual({
          activeReleaseId: fixture.state.activeReleaseId,
          projections: locales.map(({ projection }) => projection),
        });
      })
  );

  it.effect("decodes every verified Page projection with its release pin", () =>
    Effect.gen(function* () {
      const catalog = yield* readPublishedPageCatalog();

      expect(catalog).toEqual({
        activeReleaseId,
        projections: [testPageProjection],
      });
    })
  );

  it.effect("caches the complete signed Page catalog", () =>
    Effect.gen(function* () {
      const catalog = yield* Effect.tryPromise(() => getPublishedPageCatalog());

      expect(catalog).toEqual({
        activeReleaseId,
        projections: [testPageProjection],
      });
      expect(cacheMock).toHaveBeenCalledWith("page");
    })
  );

  it.effect.each([
    ["unmanaged", { activeReleaseId, managed: false, projectionJson: [] }],
    [
      "missing release",
      { activeReleaseId: null, managed: true, projectionJson: [] },
    ],
  ])("rejects an %s Page catalog", ([, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(result));

      const failure = yield* readPublishedPageCatalog().pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "PublishedProjectionError",
        publicPath: "pages",
      });
    })
  );

  it.effect("rejects malformed Page projection JSON", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          managed: true,
          projectionJson: ["{"],
        })
      );

      const failure = yield* readPublishedPageCatalog().pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "PublishedProjectionError",
        publicPath: "pages",
      });
    })
  );

  it.effect.each(["search", "lehrplaene/merdeka"])(
    "rejects a Page shadowed by the application route %s",
    (publicPath) =>
      Effect.gen(function* () {
        const projection = {
          ...testPageProjection,
          appLocale: AppLocaleSchema.make("de"),
          artifactLocale: ArtifactLocaleSchema.make("de"),
          publicPath: PublicPathSchema.make(publicPath),
        };
        runtimeQueryMock.mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId,
            managed: true,
            projectionJson: [JSON.stringify(projection)],
          })
        );

        const failure = yield* readPublishedPageCatalog().pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: "de",
          publicPath,
        });
      })
  );

  it.effect(
    "verifies the exact runtime Page against its localized catalog",
    () =>
      Effect.gen(function* () {
        const catalog = {
          activeReleaseId,
          projections: [testPageProjection],
        };
        const verified = yield* verifyPublishedPageCatalog(catalog, {
          projection: testPageProjection,
        });
        expect(verified).toEqual([testPageProjection]);

        const independentlyCachedPage = {
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          projection: testPageProjection,
        };
        expect(
          yield* verifyPublishedPageCatalog(catalog, independentlyCachedPage)
        ).toEqual([testPageProjection]);

        const projectionFailure = yield* verifyPublishedPageCatalog(catalog, {
          projection: {
            ...testPageProjection,
            publicPath: PublicPathSchema.make("other-page"),
          },
        }).pipe(Effect.flip);
        expect(projectionFailure).toMatchObject({
          _tag: "PublishedProjectionError",
          publicPath: "other-page",
        });
      })
  );

  it.effect("resolves signed locale counterparts without a route map", () =>
    Effect.gen(function* () {
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

      const found = yield* readPublishedPageLocalePath({
        currentLocale: "en",
        locale: "de",
        publicPath: "terms-of-service",
      });
      expect(found).toEqual({
        kind: "found",
        publicPath: "nutzungsbedingungen",
      });

      const unmanaged = yield* readPublishedPageLocalePath({
        currentLocale: "en",
        locale: "de",
        publicPath: "other-page",
      });
      expect(unmanaged).toEqual({ kind: "unmanaged" });

      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          managed: true,
          projectionJson: [JSON.stringify(testPageProjection)],
        })
      );
      const missing = yield* readPublishedPageLocalePath({
        currentLocale: "en",
        locale: "de",
        publicPath: "terms-of-service",
      });
      expect(missing).toEqual({ kind: "missing" });
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
