import "server-only";

import {
  APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Cause, Effect } from "effect";
import type { Locale } from "next-intl";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import {
  getPublishedMaterialRelease,
  getPublishedMaterialRoutes,
  type PublishedMaterialCatalog,
  type PublishedMaterialRelease,
} from "@/lib/content/material/catalog";
import {
  isMaterialCounterpart,
  isMaterialSibling,
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import {
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import { readRenderedMaterial } from "@/lib/content/published/material";

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

/** Preserves typed catalog failures rejected by an Effect framework runner. */
function preserveCatalogFailure(cause: unknown) {
  if (
    cause instanceof NakafaAgentDataReadError ||
    cause instanceof PublishedProjectionError
  ) {
    return cause;
  }
  return new Cause.UnknownError(
    cause,
    "Unable to read the cached material catalog."
  );
}

/** Lifts one cached locale catalog back into the publication program. */
const readCachedMaterialCatalog = Effect.fn("NakafaMaterial.readCachedCatalog")(
  (locale: Locale) =>
    Effect.tryPromise({
      catch: preserveCatalogFailure,
      try: () => getPublishedMaterialRoutes(locale),
    })
);

/** Lifts the signed release identity back into the publication program. */
const readCachedMaterialRelease = Effect.fn("NakafaMaterial.readCachedRelease")(
  () =>
    Effect.tryPromise({
      catch: preserveCatalogFailure,
      try: () => getPublishedMaterialRelease(),
    })
);

/** Orders one localized lesson group exactly like the backend index. */
function compareMaterialSiblings(
  left: MaterialLessonProjection,
  right: MaterialLessonProjection
) {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return left.publicPath.localeCompare(right.publicPath);
}

/** Selects one complete shell from low-cardinality release-bound catalogs. */
export const readMaterialCatalogRoute = Effect.fn(
  "NakafaMaterial.readCatalogRoute"
)(function* (
  release: PublishedMaterialRelease,
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
    catalogs.length !== APP_LOCALE_CODES.length ||
    catalogsByLocale.size !== APP_LOCALE_CODES.length
  ) {
    return yield* makeMaterialProjectionError(projectionIdentity);
  }
  const activeLocaleSet = new Set(release.activeAppLocales);
  for (const catalog of catalogs) {
    if (catalog.activeReleaseId !== release.activeReleaseId) {
      return yield* new PublishedReleaseMismatchError({
        actualReleaseId: catalog.activeReleaseId,
        expectedReleaseId: release.activeReleaseId,
      });
    }
    if (
      catalog.activeManifestHash !== release.activeManifestHash ||
      catalog.sourceRevision !== release.sourceRevision ||
      !hasUniquePublicPaths(catalog.routes) ||
      catalog.routes.some((route) => route.appLocale !== catalog.appLocale) ||
      (!activeLocaleSet.has(catalog.appLocale) && catalog.routes.length > 0)
    ) {
      return yield* makeMaterialProjectionError(projectionIdentity);
    }
  }

  const missingRoute = {
    activeManifestHash: release.activeManifestHash,
    activeReleaseId: release.activeReleaseId,
    alternates: [],
    projection: null,
    siblings: [],
    sourceRevision: release.sourceRevision,
  } satisfies MaterialCatalogRoute;
  if (!activeLocaleSet.has(appLocale)) {
    return missingRoute;
  }

  const projection = currentCatalog.routes.find(
    (route) => route.publicPath === publicPath
  );
  if (!projection) {
    return missingRoute;
  }

  const alternates: MaterialLessonProjection[] = [];
  for (const activeLocale of release.activeAppLocales) {
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

  const siblingGroup = currentCatalog.routes.filter(
    (candidate) => candidate.materialKey === projection.materialKey
  );
  if (
    siblingGroup.length > MATERIAL_GROUP_LIMIT ||
    siblingGroup.some((candidate) => !isMaterialSibling(projection, candidate))
  ) {
    return yield* makeMaterialProjectionError(projectionIdentity);
  }
  const siblings = [...siblingGroup].sort(compareMaterialSiblings);

  return {
    activeManifestHash: release.activeManifestHash,
    activeReleaseId: release.activeReleaseId,
    alternates,
    projection,
    siblings,
    sourceRevision: release.sourceRevision,
  } satisfies MaterialCatalogRoute;
});

/** Reads one release-bound route model from all authenticated catalogs. */
const readMaterialCatalogModel = Effect.fn("NakafaMaterial.readCatalogModel")(
  function* (locale: Locale, publicPath: string) {
    const [release, catalogs] = yield* Effect.all(
      [
        readCachedMaterialRelease(),
        Effect.forEach(APP_LOCALE_CODES, readCachedMaterialCatalog, {
          concurrency: "unbounded",
        }),
      ],
      { concurrency: "unbounded" }
    );
    return yield* readMaterialCatalogRoute(
      release,
      catalogs,
      locale,
      publicPath
    );
  }
);

/** Caches one metadata-safe shell without evaluating its MDX artifact. */
export async function getMaterialCatalogRoute(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const result = await Effect.runPromise(
    readMaterialCatalogModel(locale, publicPath)
  );
  applyPublishedCatalogCache("material");
  return result;
}

/** Reuses the metadata-safe route cache inside the full publication program. */
const readCachedMaterialCatalogRoute = Effect.fn(
  "NakafaMaterial.readCachedCatalogRoute"
)((locale: Locale, publicPath: string) =>
  Effect.tryPromise({
    catch: preserveCatalogFailure,
    try: () => getMaterialCatalogRoute(locale, publicPath),
  })
);

/** Reads and verifies one coherent material shell and body concurrently. */
const readMaterialPublication = Effect.fn("NakafaMaterial.readPublication")(
  function* (locale: Locale, publicPath: string) {
    const appLocale = AppLocaleSchema.make(locale);
    const readPublished = readRenderedMaterial({ appLocale, publicPath }).pipe(
      Effect.catchTag("ContentRuntimeMissingError", () => Effect.succeed(null))
    );
    const [model, published] = yield* Effect.all(
      [readCachedMaterialCatalogRoute(locale, publicPath), readPublished],
      { concurrency: "unbounded" }
    );
    if (!model.projection) {
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
