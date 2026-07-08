import {
  getContentPathCandidates,
  getLocaleParams,
  getLocaleSlugs,
  getStaticParams,
} from "@repo/contents/_lib/manifest/params";
import { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { Effect } from "effect";

/** Builds the source-derived manifest used by route params. */
export const buildContentRouteParamManifest = Effect.fn(
  "contents.routeManifest.params.build"
)(function* (locales: readonly string[]) {
  const source = yield* ContentRouteSource;
  const version = yield* source.getFolderCacheVersion;
  const localeSlugs = yield* getLocaleSlugs(source, locales);
  const contentRouteCandidates = yield* getContentPathCandidates(source);
  const staticParams = getStaticParams(localeSlugs, contentRouteCandidates);
  const localeParams = getLocaleParams(localeSlugs, contentRouteCandidates);

  return {
    version,
    localeParams,
    staticParams,
  };
});
