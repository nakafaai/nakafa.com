import { internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  compareSitemapPaths,
  PUBLIC_SITEMAP_PAGE_SIZE,
  PUBLIC_SITEMAP_ROUTE_KIND,
} from "@repo/backend/convex/contents/sitemap/spec";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  PublicRouteSitemapCountSchema,
  PublicSitemapDeleteResultSchema,
  SyncSummarySchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex/client";
import type { PublicRouteProjection } from "@repo/backend/scripts/sync-content/routes/rows";
import { locales } from "@repo/utilities/locales";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";

type SyncSitemapPagesArgs = FunctionArgs<
  typeof internal.contentSync.publicRoutes.internal.syncSitemapPages
>;
type PublicSitemapPage = SyncSitemapPagesArgs["pages"][number];

interface PublicSitemapArtifact {
  count: number;
  hash: string;
  locale: (typeof locales)[number];
  pages: PublicSitemapPage[];
}

class PublicSitemapProjectionError extends Schema.TaggedError<PublicSitemapProjectionError>()(
  "PublicSitemapProjectionError",
  { message: Schema.String }
) {}

const publicSitemapProjectionVersion = 1;

/** Synchronizes bounded public sitemap metadata from the route projection. */
export const syncPublicSitemapArtifacts = Effect.fn(
  "sync.publicSitemapArtifacts"
)(function* (config: ConvexConfig, projection: PublicRouteProjection) {
  const syncedAt = Date.now();
  const artifacts = yield* buildPublicSitemapArtifacts(projection, syncedAt);

  for (const artifact of artifacts) {
    const stored = yield* callConvexQuery(
      config,
      internal.contentSync.publicRoutes.internal.getSitemapCountState,
      { locale: artifact.locale },
      PublicRouteSitemapCountSchema
    );

    if (
      stored?.hash === artifact.hash &&
      stored.count === artifact.count &&
      stored.pageCount === artifact.pages.length
    ) {
      continue;
    }

    for (
      let offset = 0;
      offset < artifact.pages.length;
      offset += CONTENT_SYNC_BATCH_LIMITS.publicSitemapPages
    ) {
      const pages = artifact.pages.slice(
        offset,
        offset + CONTENT_SYNC_BATCH_LIMITS.publicSitemapPages
      );

      yield* callConvexMutation(
        config,
        internal.contentSync.publicRoutes.internal.syncSitemapPages,
        { pages },
        SyncSummarySchema
      );
    }

    yield* callConvexMutation(
      config,
      internal.contentSync.publicRoutes.internal.saveSitemapCount,
      {
        count: artifact.count,
        hash: artifact.hash,
        locale: artifact.locale,
        pageCount: artifact.pages.length,
        syncedAt,
      },
      SyncSummarySchema
    );
    yield* deleteStalePages(config, artifact);
  }
});

/** Builds deterministic locale counts and lexical sitemap page boundaries. */
export const buildPublicSitemapArtifacts = Effect.fn(
  "sync.buildPublicSitemapArtifacts"
)(function* (projection: PublicRouteProjection, syncedAt: number) {
  const artifacts: PublicSitemapArtifact[] = [];

  for (const locale of locales) {
    const paths: string[] = [];

    for (const shard of projection.shards) {
      for (const route of shard.routes) {
        if (
          route.locale === locale &&
          route.sitemap &&
          route.kind === PUBLIC_SITEMAP_ROUTE_KIND
        ) {
          paths.push(route.publicPath);
        }
      }
    }

    paths.sort(compareSitemapPaths);
    const pages: PublicSitemapPage[] = [];

    for (
      let offset = 0;
      offset < paths.length;
      offset += PUBLIC_SITEMAP_PAGE_SIZE
    ) {
      const pagePaths = paths.slice(offset, offset + PUBLIC_SITEMAP_PAGE_SIZE);
      const startPath = pagePaths.at(0);
      const endPath = pagePaths.at(-1);

      if (!(startPath && endPath)) {
        return yield* Effect.fail(
          new PublicSitemapProjectionError({
            message: `Public sitemap page ${locale}/${pages.length} has no route boundaries.`,
          })
        );
      }

      pages.push({
        endPath,
        hash: computeHash(JSON.stringify(pagePaths)),
        locale,
        page: pages.length,
        routeCount: pagePaths.length,
        startPath,
        syncedAt,
      });
    }

    artifacts.push({
      count: paths.length,
      hash: computeHash(
        JSON.stringify({ paths, version: publicSitemapProjectionVersion })
      ),
      locale,
      pages,
    });
  }

  return artifacts;
});

/** Deletes stale page rows after the new locale count stops exposing them. */
const deleteStalePages = Effect.fn("sync.deleteStalePublicSitemapPages")(
  function* (config: ConvexConfig, artifact: PublicSitemapArtifact) {
    while (true) {
      const result = yield* callConvexMutation(
        config,
        internal.contentSync.publicRoutes.internal.deleteStaleSitemapPages,
        {
          firstStalePage: artifact.pages.length,
          locale: artifact.locale,
        },
        PublicSitemapDeleteResultSchema
      );

      if (result.deleted === 0) {
        return;
      }
    }
  }
);
