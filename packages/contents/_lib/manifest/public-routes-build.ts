import { PUBLIC_CONTENT_BASE_ROUTES } from "@repo/contents/_lib/manifest/constants";
import { getLocaleSlugs } from "@repo/contents/_lib/manifest/params";
import {
  getContentRouteSets,
  getRouteRoots,
} from "@repo/contents/_lib/manifest/routes";
import {
  ContentPublicRouteManifestSchema,
  ContentRouteManifestDecodeError,
} from "@repo/contents/_lib/manifest/schema";
import { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { Effect, Schema } from "effect";

/** Builds only the public route fields used by sitemap and proxy adapters. */
export const buildContentPublicRouteManifest = Effect.fn(
  "contents.routeManifest.publicRoutes.build"
)(function* (locales: readonly string[]) {
  const source = yield* ContentRouteSource;
  const version = yield* source.getFolderCacheVersion;
  const localeSlugs = yield* getLocaleSlugs(source, locales);
  const routeSets = yield* getContentRouteSets(source, localeSlugs);
  const quranRoutes = yield* source.getQuranRoutes;
  const contentRoutes = [...routeSets.pages, ...quranRoutes];
  const publicRequestRoutes = [
    ...PUBLIC_CONTENT_BASE_ROUTES,
    ...routeSets.pages,
    ...routeSets.redirects.keys(),
    ...quranRoutes,
  ];
  const routeRoots = getRouteRoots(publicRequestRoutes);

  return yield* Schema.decodeUnknown(ContentPublicRouteManifestSchema)(
    {
      version,
      contentRoutes,
      publicRequestRoutes,
      quranRoutes,
      redirects: Array.from(routeSets.redirects),
      routeRoots,
    },
    { errors: "all" }
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ContentRouteManifestDecodeError({
          cause,
          message: "Unable to decode the content route manifest.",
        })
    )
  );
});
