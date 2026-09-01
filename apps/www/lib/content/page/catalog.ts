import "server-only";

import {
  type ActiveAppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizePublicPageProjection,
  type PublicPageProjection,
} from "@nakafa/aksara-contracts/projection/page";
import { api } from "@repo/backend/convex/_generated/api";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import { decodePublishedPageJson } from "@/lib/content/published/projection";
import { decodeContentReleasePin } from "@/lib/content/published/release";
import { readRuntimeQuery } from "@/lib/content/runtime/query";
import { isReservedPagePath } from "@/lib/routing/public/ownership";

/** Complete signed Page catalog selected from one active release. */
export interface PublishedPageCatalog {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly projections: readonly PublicPageProjection[];
}

interface PublishedPageRead {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly projection: PublicPageProjection;
}

/** Result of resolving one Page identity into another active locale. */
export type PublishedPageLocalePath =
  | { readonly kind: "found"; readonly publicPath: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unmanaged" };

/** Reads and strictly decodes every locale-equivalent Page projection. */
export const readPublishedPageCatalog = Effect.fn(
  "NakafaContent.readPublishedPageCatalog"
)(function* () {
  const identity = {
    appLocale: AppLocaleSchema.make(routing.defaultLocale),
    publicPath: "pages",
  };
  const result = yield* readRuntimeQuery(api.contentRelease.page.catalog, {});
  const activeReleaseId = yield* decodeContentReleasePin(
    result.activeReleaseId,
    undefined,
    identity
  );
  if (!(result.managed && activeReleaseId)) {
    return yield* new PublishedProjectionError(identity);
  }
  const projections = yield* Effect.forEach(result.projectionJson, (source) =>
    decodePublishedPageJson(source, identity)
  );
  const collision = projections.find(({ appLocale, publicPath }) =>
    isReservedPagePath(appLocale, publicPath)
  );
  if (collision) {
    return yield* new PublishedProjectionError({
      appLocale: collision.appLocale,
      publicPath: collision.publicPath,
    });
  }
  return { activeReleaseId, projections } satisfies PublishedPageCatalog;
});

/** Caches the complete Page catalog under its signed family owner. */
export async function getPublishedPageCatalog() {
  "use cache";

  const catalog = await Effect.runPromise(readPublishedPageCatalog());
  applyPublishedCatalogCache("page");
  return catalog;
}

/** Proves one runtime Page and its localized counterparts share a release. */
export const verifyPublishedPageCatalog = Effect.fn(
  "NakafaContent.verifyPublishedPageCatalog"
)(function* (catalog: PublishedPageCatalog, page: PublishedPageRead) {
  if (catalog.activeReleaseId !== page.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: page.activeReleaseId,
      expectedReleaseId: catalog.activeReleaseId,
    });
  }
  const counterparts = catalog.projections.filter(
    ({ pageKey }) => pageKey === page.projection.pageKey
  );
  const current = counterparts.find(
    ({ appLocale }) => appLocale === page.projection.appLocale
  );
  if (
    !current ||
    canonicalizePublicPageProjection(current) !==
      canonicalizePublicPageProjection(page.projection)
  ) {
    return yield* new PublishedProjectionError({
      appLocale: page.projection.appLocale,
      publicPath: page.projection.publicPath,
    });
  }
  return counterparts;
});

/** Resolves one signed Page counterpart by stable Page identity. */
export const readPublishedPageLocalePath = Effect.fn(
  "NakafaContent.readPublishedPageLocalePath"
)(function* ({
  currentLocale,
  locale,
  publicPath,
}: {
  readonly currentLocale: ActiveAppLocaleCode;
  readonly locale: ActiveAppLocaleCode;
  readonly publicPath: string;
}) {
  const catalog = yield* readPublishedPageCatalog();
  const current = catalog.projections.find(
    (projection) =>
      projection.appLocale === currentLocale &&
      projection.publicPath === publicPath
  );
  if (!current) {
    return { kind: "unmanaged" } satisfies PublishedPageLocalePath;
  }
  const target = catalog.projections.find(
    (projection) =>
      projection.appLocale === locale && projection.pageKey === current.pageKey
  );
  if (!target) {
    return { kind: "missing" } satisfies PublishedPageLocalePath;
  }
  return {
    kind: "found",
    publicPath: target.publicPath,
  } satisfies PublishedPageLocalePath;
});
