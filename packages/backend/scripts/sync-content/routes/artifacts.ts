import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
  NAKAFA_CONTENT_SECTIONS,
} from "@repo/backend/convex/contents/constants";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import {
  RuntimeContentRoutePageSchema,
  SyncSummarySchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex/client";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const DeleteStaleRoutePagesResultSchema = Schema.Struct({
  deleted: Schema.Number,
});
type RuntimeContentRoutePage = Schema.Schema.Type<
  typeof RuntimeContentRoutePageSchema
>;

/** Rebuilds bounded route artifact pages from the synced route catalog. */
export const syncContentRouteArtifactPages = Effect.fn(
  "sync.contentRouteArtifactPages"
)(function* (config: ConvexConfig, options: SyncOptions) {
  const syncedAt = Date.now();
  const totals: SyncResult = { created: 0, unchanged: 0, updated: 0 };
  const syncLocales = options.locale ? [options.locale] : locales;

  for (const locale of syncLocales) {
    for (const section of NAKAFA_CONTENT_SECTIONS) {
      const result = yield* syncRouteArtifactPagesForSection(config, {
        locale,
        section,
        syncedAt,
      });
      totals.created += result.created;
      totals.unchanged += result.unchanged;
      totals.updated += result.updated;
    }
  }

  return totals;
});

/** Rebuilds all route artifact pages for one locale and content section. */
function syncRouteArtifactPagesForSection(
  config: ConvexConfig,
  args: {
    locale: (typeof locales)[number];
    section: NakafaSection;
    syncedAt: number;
  }
) {
  return Effect.gen(function* () {
    const totals: SyncResult = { created: 0, unchanged: 0, updated: 0 };
    let cursor: string | null = null;
    let pageNumber = 0;
    let routeCount = 0;

    while (true) {
      const routePage: RuntimeContentRoutePage = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.listContentRoutesByPrefix,
        {
          cursor,
          limit: CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
          locale: args.locale,
          prefix: "",
          section: args.section,
        },
        RuntimeContentRoutePageSchema
      );
      routeCount += routePage.page.length;

      if (routePage.page.length > 0) {
        const result = yield* callConvexMutation(
          config,
          internal.contentSync.mutations.routes.syncContentRouteArtifactPage,
          {
            locale: args.locale,
            page: pageNumber,
            routes: routePage.page,
            section: args.section,
            syncedAt: args.syncedAt,
          },
          SyncSummarySchema
        );

        totals.created += result.created;
        totals.unchanged += result.unchanged;
        totals.updated += result.updated;
        pageNumber++;
      }

      if (routePage.isDone) {
        break;
      }

      cursor = routePage.continueCursor;
    }

    yield* deleteStaleRouteArtifactPages(config, {
      firstStalePage: pageNumber,
      locale: args.locale,
      section: args.section,
    });
    yield* syncRouteArtifactCount(config, {
      count: routeCount,
      locale: args.locale,
      section: args.section,
      syncedAt: args.syncedAt,
    });

    return totals;
  });
}

/** Stores the route count produced by one section's rebuilt artifact pages. */
function syncRouteArtifactCount(
  config: ConvexConfig,
  args: {
    count: number;
    locale: (typeof locales)[number];
    section: NakafaSection;
    syncedAt: number;
  }
) {
  return callConvexMutation(
    config,
    internal.contentSync.mutations.routes.syncContentRouteArtifactCount,
    args,
    SyncSummarySchema
  );
}

/** Deletes stale route artifact pages through repeated bounded batches. */
function deleteStaleRouteArtifactPages(
  config: ConvexConfig,
  args: {
    firstStalePage: number;
    locale: (typeof locales)[number];
    section: NakafaSection;
  }
) {
  return Effect.gen(function* () {
    while (true) {
      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.routes
          .deleteStaleContentRouteArtifactPages,
        args,
        DeleteStaleRoutePagesResultSchema
      );

      if (result.deleted === 0) {
        return;
      }
    }
  });
}
