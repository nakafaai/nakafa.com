import { PUBLIC_CONTENT_BASE_ROUTES } from "@repo/contents/_lib/manifest/constants";
import {
  getContentPathCandidates,
  getLocaleParams,
  getLocaleSlugs,
  getStaticParams,
} from "@repo/contents/_lib/manifest/params";
import {
  getContentRouteSets,
  getRouteRoots,
} from "@repo/contents/_lib/manifest/routes";
import {
  ContentRouteManifestDecodeError,
  ContentRouteManifestSchema,
} from "@repo/contents/_lib/manifest/schema";
import { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { Effect, Schema } from "effect";

/** Builds the content route manifest as a native Effect program. */
export const buildContentRouteManifest = Effect.fn(
  "contents.routeManifest.build"
)(function* (locales: readonly string[]) {
  const source = yield* ContentRouteSource;
  const version = yield* source.getFolderCacheVersion;
  const localeSlugs = yield* getLocaleSlugs(source, locales);
  const contentRouteCandidates = yield* getContentPathCandidates(source);
  const staticParams = getStaticParams(localeSlugs, contentRouteCandidates);
  const localeParams = getLocaleParams(localeSlugs, contentRouteCandidates);
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

  return yield* Schema.decodeUnknown(ContentRouteManifestSchema)(
    {
      version,
      contentRoutes,
      localeParams,
      publicRequestRoutes,
      quranRoutes,
      redirects: Array.from(routeSets.redirects),
      routeRoots,
      staticParams,
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
