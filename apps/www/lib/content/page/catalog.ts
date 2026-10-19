import { DEFAULT_LOCALE } from "@repo/internationalization/src/locale";
import "@tanstack/react-start/server-only";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  type ActiveAppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizePublicPageProjection,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodePublishedPageJson } from "@/lib/content/published/projection";
import { decodeContentReleasePin } from "@/lib/content/published/release";
import { queryContentStore } from "@/lib/content/store/query";
import { isReservedPagePath } from "@/lib/ownership/route";

const PublishedPageCatalogSchema = Schema.Struct({
  activeReleaseId: ReleaseIdSchema,
  projections: Schema.Array(PublicPageProjectionSchema),
});
/** Complete signed Page catalog selected from one active release. */
type PublishedPageCatalog = typeof PublishedPageCatalogSchema.Type;
const PublishedPageReadSchema = Schema.Struct({
  projection: PublicPageProjectionSchema,
});
type PublishedPageRead = typeof PublishedPageReadSchema.Type;

const PublishedPageLocalePathSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("found"),
    publicPath: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("missing"),
  }),
  Schema.Struct({
    kind: Schema.Literal("unmanaged"),
  }),
]);
/** Result of resolving one Page identity into another active locale. */
type PublishedPageLocalePath = typeof PublishedPageLocalePathSchema.Type;

/**
 * Reads and strictly decodes every locale-equivalent Page projection. The
 * shells, the sitemap, the locale switch and the legal pages all read the
 * catalog here, and the content store holds it once for each release.
 */
export const readPublishedPageCatalog = Effect.fn(
  "NakafaContent.readPublishedPageCatalog"
)(function* () {
  const identity = {
    appLocale: AppLocaleSchema.make(DEFAULT_LOCALE),
    publicPath: "pages",
  };
  const result = yield* queryContentStore(contentRelease.page.catalog, {});
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
  const collision = Arr.findFirst(projections, ({ appLocale, publicPath }) =>
    isReservedPagePath(appLocale, publicPath)
  );
  if (Option.isSome(collision)) {
    return yield* new PublishedProjectionError({
      appLocale: collision.value.appLocale,
      publicPath: collision.value.publicPath,
    });
  }
  return {
    activeReleaseId,
    projections,
  } satisfies PublishedPageCatalog;
});

/**
 * Caches the complete Page catalog under its signed family owner. The `use
 * cache` boundary stays so that the legal pages prerender and the page tag
 * still expires them.
 */
export async function getPublishedPageCatalog() {
  const catalog = await Effect.runPromise(
    readPublishedPageCatalog().pipe(Effect.withTracerTiming(false))
  );
  return catalog;
}

/** Proves a cached Page still matches its current signed catalog projection. */
export const verifyPublishedPageCatalog = Effect.fn(
  "NakafaContent.verifyPublishedPageCatalog"
)(function* (catalog: PublishedPageCatalog, page: PublishedPageRead) {
  const counterparts = Arr.filter(
    catalog.projections,
    ({ pageKey }) => pageKey === page.projection.pageKey
  );
  const current = Arr.findFirst(
    counterparts,
    ({ appLocale }) => appLocale === page.projection.appLocale
  );
  if (
    Option.isNone(current) ||
    canonicalizePublicPageProjection(current.value) !==
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
  const current = Arr.findFirst(
    catalog.projections,
    (projection) =>
      projection.appLocale === currentLocale &&
      projection.publicPath === publicPath
  );
  if (Option.isNone(current)) {
    return {
      kind: "unmanaged",
    } satisfies PublishedPageLocalePath;
  }
  const target = Arr.findFirst(
    catalog.projections,
    (projection) =>
      projection.appLocale === locale &&
      projection.pageKey === current.value.pageKey
  );
  if (Option.isNone(target)) {
    return {
      kind: "missing",
    } satisfies PublishedPageLocalePath;
  }
  return {
    kind: "found",
    publicPath: target.value.publicPath,
  } satisfies PublishedPageLocalePath;
});
