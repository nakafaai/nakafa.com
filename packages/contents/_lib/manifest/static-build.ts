import {
  getContentPathCandidates,
  getLocaleParams,
  getLocaleSlugs,
  getStaticParams,
} from "@repo/contents/_lib/manifest/params";
import { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { Effect } from "effect";

/** Builds only the route static params consumed by framework adapters. */
export const buildContentStaticParamManifest = Effect.fn(
  "contents.routeManifest.staticParams.build"
)(function* (locales: readonly string[]) {
  const source = yield* ContentRouteSource;
  const version = yield* source.getFolderCacheVersion;
  const localeSlugs = yield* getLocaleSlugs(source, locales);
  const contentRouteCandidates = yield* getContentPathCandidates(source);

  return {
    version,
    localeParams: getLocaleParams(localeSlugs, contentRouteCandidates),
    staticParams: yield* getStaticParams(source, localeSlugs),
  };
});
