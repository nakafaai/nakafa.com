import "server-only";

import {
  ACTIVE_APP_LOCALES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import {
  getPublishedMaterialRoutes,
  type PublishedMaterialCatalog,
} from "@/lib/content/material/catalog";
import {
  isMaterialCounterpart,
  isMaterialSibling,
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import { renderPublishedMaterial } from "@/lib/content/published/material";

interface MaterialCatalogIdentity {
  readonly activeManifestHash: PublishedMaterialCatalog["activeManifestHash"];
  readonly activeReleaseId: PublishedMaterialCatalog["activeReleaseId"];
  readonly sourceRevision: PublishedMaterialCatalog["sourceRevision"];
}

/** Route shell selected exclusively from authenticated release catalogs. */
export type MaterialCatalogRoute = MaterialCatalogIdentity &
  (
    | {
        readonly alternates: readonly [];
        readonly projection: null;
        readonly siblings: readonly [];
      }
    | {
        readonly alternates: readonly MaterialLessonProjection[];
        readonly projection: MaterialLessonProjection;
        readonly siblings: readonly MaterialLessonProjection[];
      }
  );

/** Checks a decoded route set for one unambiguous public identity. */
function hasUniquePublicPaths(routes: readonly MaterialLessonProjection[]) {
  return (
    new Set(routes.map(({ publicPath }) => publicPath)).size === routes.length
  );
}

/** Selects one complete shell from low-cardinality release-bound catalogs. */
export const readMaterialCatalogRoute = Effect.fn(
  "NakafaMaterial.readCatalogRoute"
)(function* (
  catalogs: readonly PublishedMaterialCatalog[],
  locale: Locale,
  publicPath: string
) {
  const appLocale = AppLocaleSchema.make(locale);
  const projectionIdentity = { appLocale, publicPath };
  const catalogsByLocale = new Map(
    catalogs.map((catalog) => [catalog.appLocale, catalog])
  );
  const currentCatalog = catalogsByLocale.get(appLocale);
  if (!currentCatalog) {
    return yield* makeMaterialProjectionError(projectionIdentity);
  }
  if (
    catalogs.length !== ACTIVE_APP_LOCALES.length ||
    catalogsByLocale.size !== ACTIVE_APP_LOCALES.length
  ) {
    return yield* makeMaterialProjectionError(projectionIdentity);
  }
  for (const catalog of catalogs) {
    if (catalog.activeReleaseId !== currentCatalog.activeReleaseId) {
      return yield* new PublishedReleaseMismatchError({
        actualReleaseId: catalog.activeReleaseId,
        expectedReleaseId: currentCatalog.activeReleaseId,
      });
    }
    if (
      catalog.activeManifestHash !== currentCatalog.activeManifestHash ||
      catalog.sourceRevision !== currentCatalog.sourceRevision ||
      !hasUniquePublicPaths(catalog.routes) ||
      catalog.routes.some((route) => route.appLocale !== catalog.appLocale)
    ) {
      return yield* makeMaterialProjectionError(projectionIdentity);
    }
  }

  const projection = currentCatalog.routes.find(
    (route) => route.publicPath === publicPath
  );
  if (!projection) {
    return {
      activeManifestHash: currentCatalog.activeManifestHash,
      activeReleaseId: currentCatalog.activeReleaseId,
      alternates: [],
      projection: null,
      siblings: [],
      sourceRevision: currentCatalog.sourceRevision,
    } satisfies MaterialCatalogRoute;
  }

  const alternates: MaterialLessonProjection[] = [];
  for (const activeLocale of ACTIVE_APP_LOCALES) {
    const counterparts = catalogs.flatMap((catalog) =>
      catalog.appLocale === activeLocale
        ? catalog.routes.filter((candidate) =>
            isMaterialCounterpart(projection, candidate)
          )
        : []
    );
    const counterpart = counterparts[0];
    if (!counterpart || counterparts.length !== 1) {
      return yield* makeMaterialProjectionError(projectionIdentity);
    }
    alternates.push(counterpart);
  }

  const siblings = currentCatalog.routes.filter((candidate) =>
    isMaterialSibling(projection, candidate)
  );

  return {
    activeManifestHash: currentCatalog.activeManifestHash,
    activeReleaseId: currentCatalog.activeReleaseId,
    alternates,
    projection,
    siblings,
    sourceRevision: currentCatalog.sourceRevision,
  } satisfies MaterialCatalogRoute;
});

/** Reads and verifies one coherent material shell and body concurrently. */
const readMaterialPublication = Effect.fn("NakafaMaterial.readPublication")(
  function* (locale: Locale, publicPath: string) {
    const appLocale = AppLocaleSchema.make(locale);
    const readCatalogs = Effect.forEach(
      ACTIVE_APP_LOCALES,
      (activeLocale) =>
        Effect.tryPromise(() => getPublishedMaterialRoutes(activeLocale)),
      { concurrency: "unbounded" }
    );
    const readPublished = Effect.tryPromise(() =>
      renderPublishedMaterial({ appLocale, publicPath })
    ).pipe(
      Effect.catchIf(
        (failure) => failure.cause instanceof ContentRuntimeMissingError,
        () => Effect.succeed(null)
      )
    );
    const [catalogs, published] = yield* Effect.all(
      [readCatalogs, readPublished],
      { concurrency: "unbounded" }
    );
    const model = yield* readMaterialCatalogRoute(catalogs, locale, publicPath);
    if (!model.projection) {
      yield* Effect.sync(() => applyPublishedCatalogCache("material"));
      if (published) {
        return yield* makeMaterialProjectionError({ appLocale, publicPath });
      }
      return null;
    }
    if (!published) {
      return yield* makeMaterialProjectionError({ appLocale, publicPath });
    }

    yield* verifyMaterialPublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      published
    );
    yield* Effect.sync(() =>
      applyPublishedContentCache("material", published.artifactHash)
    );

    return { model, published };
  }
);

/** Caches one coherent material publication at the Next.js framework boundary. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  return await Effect.runPromise(readMaterialPublication(locale, publicPath));
}
