import { internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  compareSitemapPaths,
  PUBLIC_SITEMAP_PAGE_SIZE,
  PUBLIC_SITEMAP_ROUTE_KINDS,
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
import { getConvexSize } from "convex/values";
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

const maximumSitemapWriteBatchBytes = 2 * 1024 * 1024;
const publicSitemapProjectionVersion = 2;

/** Synchronizes bounded public sitemap metadata from the route projection. */
export const syncPublicSitemapArtifacts = Effect.fn(
  "sync.publicSitemapArtifacts"
)(function* (config: ConvexConfig, projection: PublicRouteProjection) {
  const startedAt = Date.now();
  const artifacts = yield* buildPublicSitemapArtifacts(projection, startedAt);

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
      yield* deleteOlderPages(config, artifact.locale, stored.syncedAt);
      continue;
    }

    const syncedAt = Math.max(startedAt, (stored?.syncedAt ?? 0) + 1);
    const pages = artifact.pages.map((page) => ({ ...page, syncedAt }));

    yield* writeSitemapPages(config, pages);

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
    yield* deleteOlderPages(config, artifact.locale, syncedAt);
  }
});

/** Builds deterministic locale counts and exact bounded sitemap pages. */
export const buildPublicSitemapArtifacts = Effect.fn(
  "sync.buildPublicSitemapArtifacts"
)(function* (projection: PublicRouteProjection, syncedAt: number) {
  const artifacts: PublicSitemapArtifact[] = [];

  for (const locale of locales) {
    const paths: string[] = [];

    for (const shard of projection.shards) {
      for (const route of shard.routes) {
        if (route.locale !== locale || !route.sitemap) {
          continue;
        }

        const isOwnedKind = PUBLIC_SITEMAP_ROUTE_KINDS.some(
          (kind) => kind === route.kind
        );

        if (!isOwnedKind) {
          continue;
        }

        paths.push(route.publicPath);
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

      if (pagePaths.length === 0) {
        return yield* Effect.fail(
          new PublicSitemapProjectionError({
            message: `Public sitemap page ${locale}/${pages.length} has no paths.`,
          })
        );
      }

      pages.push({
        locale,
        page: pages.length,
        paths: pagePaths,
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

/** Writes sitemap pages in count- and byte-bounded mutation batches. */
const writeSitemapPages = Effect.fn("sync.writePublicSitemapPages")(function* (
  config: ConvexConfig,
  pages: readonly PublicSitemapPage[]
) {
  const batches = buildSitemapPageBatches(pages);

  for (const batch of batches) {
    yield* callConvexMutation(
      config,
      internal.contentSync.publicRoutes.internal.syncSitemapPages,
      { pages: batch },
      SyncSummarySchema
    );
  }
});

/** Packs exact path pages below Convex transaction and argument limits. */
function buildSitemapPageBatches(pages: readonly PublicSitemapPage[]) {
  const batches: PublicSitemapPage[][] = [];
  let batch: PublicSitemapPage[] = [];

  for (const page of pages) {
    const candidate = [...batch, page];
    const exceedsCount =
      candidate.length > CONTENT_SYNC_BATCH_LIMITS.publicSitemapPages;
    const exceedsBytes =
      getConvexSize({ pages: candidate }) > maximumSitemapWriteBatchBytes;

    if (batch.length > 0 && (exceedsCount || exceedsBytes)) {
      batches.push(batch);
      batch = [page];
      continue;
    }

    batch = candidate;
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
}

/** Deletes obsolete generations after their replacement is committed. */
const deleteOlderPages = Effect.fn("sync.deleteOlderPublicSitemapPages")(
  function* (
    config: ConvexConfig,
    locale: PublicSitemapArtifact["locale"],
    committedSyncedAt: number
  ) {
    while (true) {
      const result = yield* callConvexMutation(
        config,
        internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages,
        {
          committedSyncedAt,
          locale,
        },
        PublicSitemapDeleteResultSchema
      );

      if (result.deleted === 0) {
        return;
      }
    }
  }
);
