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
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex/client";
import { type Locale, locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const DeleteStaleRoutePagesResultSchema = Schema.Struct({
  deleted: Schema.Number,
});
const RuntimeContentRouteCountSchema = Schema.Struct({
  count: Schema.Number,
  locale: Schema.Literal(...locales),
  section: Schema.Literal(...NAKAFA_CONTENT_SECTIONS),
  syncedAt: Schema.Number,
});
const RuntimeContentRouteCountsSchema = Schema.mutable(
  Schema.Array(RuntimeContentRouteCountSchema)
);
type RuntimeContentRoutePage = Schema.Schema.Type<
  typeof RuntimeContentRoutePageSchema
>;

/** One locale and section whose bounded route artifacts must be rebuilt. */
export interface ContentRouteArtifactTarget {
  readonly locale: Locale;
  readonly section: NakafaSection;
}

/** Builds deterministic route artifact targets for full or section-scoped syncs. */
export function createContentRouteArtifactTargets(
  locale?: Locale,
  sections: readonly NakafaSection[] = NAKAFA_CONTENT_SECTIONS
): ContentRouteArtifactTarget[] {
  const targetLocales = locale ? [locale] : locales;

  return sections.flatMap((section) =>
    targetLocales.map((targetLocale) => ({
      locale: targetLocale,
      section,
    }))
  );
}

/** Rebuilds only the requested bounded route artifact targets. */
export const syncContentRouteArtifactPages = Effect.fn(
  "sync.contentRouteArtifactPages"
)(function* (
  config: ConvexConfig,
  targets: readonly ContentRouteArtifactTarget[]
) {
  const totals: SyncResult = { created: 0, unchanged: 0, updated: 0 };
  const committedGenerations = yield* readCommittedGenerations(config, targets);

  for (const target of targets) {
    const committedGeneration =
      committedGenerations.get(readTargetKey(target)) ?? 0;
    const syncedAt = Math.max(Date.now(), committedGeneration + 1);
    const result = yield* syncRouteArtifactPagesForSection(config, {
      ...target,
      syncedAt,
    });
    totals.created += result.created;
    totals.unchanged += result.unchanged;
    totals.updated += result.updated;
  }

  return totals;
});

/** Reads committed generations once per locale before staging replacement pages. */
function readCommittedGenerations(
  config: ConvexConfig,
  targets: readonly ContentRouteArtifactTarget[]
) {
  return Effect.gen(function* () {
    const generations = new Map<string, number>();
    const targetLocales = locales.filter((locale) =>
      targets.some((target) => target.locale === locale)
    );

    for (const locale of targetLocales) {
      const counts = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.listContentRouteCounts,
        { locale },
        RuntimeContentRouteCountsSchema
      );

      for (const count of counts) {
        generations.set(readTargetKey(count), count.syncedAt);
      }
    }

    return generations;
  });
}

/** Builds the stable lookup key for one locale and section pointer. */
function readTargetKey(target: ContentRouteArtifactTarget) {
  return `${target.locale}:${target.section}`;
}

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

    yield* syncRouteArtifactCount(config, {
      count: routeCount,
      locale: args.locale,
      section: args.section,
      syncedAt: args.syncedAt,
    });
    yield* deleteStaleRouteArtifactPages(config, {
      committedSyncedAt: args.syncedAt,
      locale: args.locale,
      section: args.section,
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
    committedSyncedAt: number;
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
