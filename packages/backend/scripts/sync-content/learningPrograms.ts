import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
  NAKAFA_CONTENT_SECTIONS,
} from "@repo/backend/convex/contents/constants";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex";
import { log } from "@repo/backend/scripts/sync-content/logging";
import {
  DeleteResultSchema,
  RuntimeContentRoutePageSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import {
  getLearningProgramCoverageAlignmentIssues,
  LEARNING_PROGRAM_COVERAGE_ALIGNMENTS,
} from "@repo/contents/_types/program/alignment";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import { projectLearningProgramCoverageInputs } from "@repo/contents/_types/program/coverage";
import {
  type LearningProgramCoverageRoute,
  LearningProgramCoverageRouteSchema,
} from "@repo/contents/_types/program/schema";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const COVERAGE_DELETE_BATCH_SIZE = 200;
const LearningProgramSyncResultSchema = Schema.Struct({
  created: Schema.Number,
  skipped: Schema.Number,
  updated: Schema.Number,
});
class LearningProgramCoverageAlignmentError extends Schema.TaggedError<LearningProgramCoverageAlignmentError>()(
  "LearningProgramCoverageAlignmentError",
  {
    message: Schema.String,
  }
) {}
type RuntimeContentRoutePage = Schema.Schema.Type<
  typeof RuntimeContentRoutePageSchema
>;
type LearningProgramSyncResult = Schema.Schema.Type<
  typeof LearningProgramSyncResultSchema
>;

/** Syncs the program catalog and graph-backed coverage read model. */
export const syncLearningPrograms = Effect.fn("sync.learningPrograms")(
  function* (config: ConvexConfig, options: SyncOptions) {
    yield* assertCoverageAlignments();

    const syncedAt = Date.now();
    const syncLocales = options.locale ? [options.locale] : locales;
    const catalogResult = yield* callConvexMutation(
      config,
      internal.learningPrograms.sync.syncLearningPrograms,
      { programs: getLearningProgramCatalogInputs(), syncedAt },
      LearningProgramSyncResultSchema
    );
    const routes = yield* collectLearningProgramCoverageRoutes(config, options);
    const coverageRows = yield* projectLearningProgramCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG,
      routes,
      syncedAt,
    });
    const coverageResult = yield* callConvexMutation(
      config,
      internal.learningPrograms.sync.syncLearningProgramCoverage,
      { coverageRows },
      LearningProgramSyncResultSchema
    );
    const deletedCoverageRows = yield* deleteStaleCoverageRows(config, {
      locales: syncLocales,
      syncedAt,
    });

    if (!options.quiet) {
      logLearningProgramSync({
        catalogResult,
        coverageResult,
        coverageRows: coverageRows.length,
        deletedCoverageRows,
        routes: routes.length,
      });
    }

    return toSyncResult(catalogResult, coverageResult);
  }
);

/** Collects graph route rows that the program coverage contract can own. */
function collectLearningProgramCoverageRoutes(
  config: ConvexConfig,
  options: SyncOptions
) {
  return Effect.gen(function* () {
    const routes: LearningProgramCoverageRoute[] = [];
    const syncLocales = options.locale ? [options.locale] : locales;

    for (const locale of syncLocales) {
      for (const section of NAKAFA_CONTENT_SECTIONS) {
        let cursor: string | null = null;

        while (true) {
          const routePage: RuntimeContentRoutePage = yield* callConvexQuery(
            config,
            api.contents.queries.runtime.listContentRoutesByPrefix,
            {
              cursor,
              limit: CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
              locale,
              prefix: "",
              section,
            },
            RuntimeContentRoutePageSchema
          );

          for (const row of routePage.page) {
            const coverageRoute = toLearningProgramCoverageRoute(row);
            if (coverageRoute) {
              routes.push(coverageRoute);
            }
          }

          if (routePage.isDone) {
            break;
          }

          cursor = routePage.continueCursor;
        }
      }
    }

    return routes;
  });
}

/** Removes coverage rows that were derived from older route sync snapshots. */
function deleteStaleCoverageRows(
  config: ConvexConfig,
  args: {
    locales: readonly (typeof locales)[number][];
    syncedAt: number;
  }
) {
  return Effect.gen(function* () {
    let deleted = 0;

    for (const locale of args.locales) {
      while (true) {
        const result = yield* callConvexMutation(
          config,
          internal.learningPrograms.sync.deleteStaleLearningProgramCoverage,
          {
            limit: COVERAGE_DELETE_BATCH_SIZE,
            locale,
            syncedAt: args.syncedAt,
          },
          DeleteResultSchema
        );
        deleted += result.deleted;

        if (result.deleted === 0) {
          break;
        }
      }
    }

    return deleted;
  });
}

/** Narrows one content route row into the program coverage route contract. */
function toLearningProgramCoverageRoute(
  route: RuntimeContentRoutePage["page"][number]
) {
  const candidate = {
    assetId: route.assetId,
    conceptId: route.conceptId,
    kind: route.kind,
    lensId: route.lensId,
    locale: route.locale,
    route: route.route,
    sourcePath: route.sourcePath,
  };

  if (!Schema.is(LearningProgramCoverageRouteSchema)(candidate)) {
    return null;
  }

  return candidate;
}

/** Fails fast if source-registry coverage rules point at missing programs. */
function assertCoverageAlignments() {
  return Effect.gen(function* () {
    const issues = getLearningProgramCoverageAlignmentIssues({
      alignments: LEARNING_PROGRAM_COVERAGE_ALIGNMENTS,
      programs: LEARNING_PROGRAM_CATALOG,
    });

    if (issues.length === 0) {
      return;
    }

    return yield* Effect.fail(
      new LearningProgramCoverageAlignmentError({
        message: `Invalid learning program coverage alignment: ${issues[0]}`,
      })
    );
  });
}

/** Converts catalog and coverage mutation results into workflow metrics. */
function toSyncResult(
  catalogResult: LearningProgramSyncResult,
  coverageResult: LearningProgramSyncResult
): SyncResult {
  return {
    created: catalogResult.created + coverageResult.created,
    skipped: catalogResult.skipped + coverageResult.skipped,
    unchanged: 0,
    updated: catalogResult.updated + coverageResult.updated,
  };
}

/** Logs the source-route projection result without exposing route identity as product identity. */
function logLearningProgramSync({
  catalogResult,
  coverageResult,
  coverageRows,
  deletedCoverageRows,
  routes,
}: {
  catalogResult: LearningProgramSyncResult;
  coverageResult: LearningProgramSyncResult;
  coverageRows: number;
  deletedCoverageRows: number;
  routes: number;
}) {
  log(
    `  Catalog: ${catalogResult.created} new, ${catalogResult.updated} updated`
  );
  log(
    `  Coverage: ${coverageRows} rows from ${routes} graph routes (${coverageResult.created} new, ${coverageResult.updated} updated, ${coverageResult.skipped} skipped)`
  );
  if (deletedCoverageRows > 0) {
    log(`  Stale Coverage: ${deletedCoverageRows} deleted`);
  }
}
