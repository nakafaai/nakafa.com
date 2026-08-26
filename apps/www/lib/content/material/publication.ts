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
  } satisfies MaterialCatalogRoute;
});

/** Reads one coherent material shell and body without a sequential network waterfall. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const appLocale = AppLocaleSchema.make(locale);
  const readPublished = Effect.tryPromise(() =>
    renderPublishedMaterial({ appLocale, publicPath })
  ).pipe(
    Effect.catchIf(
      (failure) => failure.cause instanceof ContentRuntimeMissingError,
      () => Effect.succeed(null)
    )
  );
  const [catalogs, published] = await Promise.all([
    Promise.all(
      ACTIVE_APP_LOCALES.map((activeLocale) =>
        getPublishedMaterialRoutes(activeLocale)
      )
    ),
    Effect.runPromise(readPublished),
  ]);
  const model = await Effect.runPromise(
    readMaterialCatalogRoute(catalogs, locale, publicPath)
  );
  if (!model.projection) {
    applyPublishedCatalogCache("material");
    if (published) {
      return await Effect.runPromise(
        Effect.fail(makeMaterialProjectionError({ appLocale, publicPath }))
      );
    }
    return null;
  }
  if (!published) {
    return await Effect.runPromise(
      Effect.fail(makeMaterialProjectionError({ appLocale, publicPath }))
    );
  }

  await Effect.runPromise(
    verifyMaterialPublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      published
    )
  );
  applyPublishedContentCache("material", published.artifactHash);

  return { model, published };
}
