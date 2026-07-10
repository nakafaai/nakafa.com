import { api } from "@repo/backend/convex/_generated/api";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import {
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { RuntimeContentRoutePageSchema } from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex/client";
import { getGraphIdentityIntegrity } from "@repo/backend/scripts/sync-content/convex/inspection";
import {
  createLearningGraphIdentityFromRoute,
  type LearningGraphIdentity,
} from "@repo/contents/_types/learning-graph";
import { locales } from "@repo/utilities/locales";
import { Effect, type Schema } from "effect";

type PersistedGraphIdentityIntegrity = Effect.Effect.Success<
  ReturnType<typeof getGraphIdentityIntegrity>
>;
type RuntimeContentRoutePage = Schema.Schema.Type<
  typeof RuntimeContentRoutePageSchema
>;
type RuntimeContentRoute = Schema.Schema.Type<
  typeof RuntimeContentRoutePageSchema
>["page"][number];

interface TryoutGraphIdentityAlignment {
  checkedRoutes: number;
  mismatches: string[];
}

/** Reads every try-out route and compares persisted graph IDs to local source projections. */
export const getTryoutGraphIdentityAlignment = Effect.fn(
  "sync.getTryoutGraphIdentityAlignment"
)(function* (config: ConvexConfig, options: SyncOptions) {
  const activeLocales = options.locale ? [options.locale] : locales;
  const result: TryoutGraphIdentityAlignment = {
    checkedRoutes: 0,
    mismatches: [],
  };

  for (const locale of activeLocales) {
    let cursor: string | null = null;

    while (true) {
      const routePage: RuntimeContentRoutePage = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.listContentRoutesByPrefix,
        {
          cursor,
          limit: CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
          locale,
          prefix: "try-out",
          section: "tryout",
        },
        RuntimeContentRoutePageSchema
      );

      for (const route of routePage.page) {
        result.checkedRoutes += 1;
        const mismatch = getTryoutGraphIdentityMismatch(route);

        if (mismatch) {
          result.mismatches.push(mismatch);
        }
      }

      if (routePage.isDone) {
        break;
      }

      cursor = routePage.continueCursor;
    }
  }

  return result;
});

/** Verifies persisted graph structure and local try-out source alignment together. */
export const verifyGraphIdentity = Effect.fn("sync.verifyGraphIdentity")(
  function* (config: ConvexConfig, options: SyncOptions) {
    const persisted = yield* getGraphIdentityIntegrity(config);
    const tryouts = yield* getTryoutGraphIdentityAlignment(config, options);

    const persistedMatches = logPersistedGraphIdentity(persisted);
    const tryoutsMatch = logTryoutGraphIdentityAlignment(tryouts);

    return persistedMatches && tryoutsMatch;
  }
);

/** Describes one route whose persisted graph identity differs from its source. */
function getTryoutGraphIdentityMismatch(route: RuntimeContentRoute) {
  const expected = createLearningGraphIdentityFromRoute({
    locale: route.locale,
    route: route.route,
  });

  if (!expected) {
    return `${route.locale}/${route.route}: source projection unavailable`;
  }

  const fields = getMismatchedGraphIdentityFields(route, expected);

  if (fields.length === 0) {
    return;
  }

  return `${route.locale}/${route.route}: ${fields.join(", ")}`;
}

/** Lists graph identity fields that differ from one source-derived identity. */
function getMismatchedGraphIdentityFields(
  route: RuntimeContentRoute,
  expected: LearningGraphIdentity
) {
  const fields: string[] = [];

  if (route.alignmentId !== expected.alignmentId) {
    fields.push("alignmentId");
  }
  if (route.assetId !== expected.assetId) {
    fields.push("assetId");
  }
  if (route.conceptId !== expected.conceptId) {
    fields.push("conceptId");
  }
  if (route.content_id !== expected.assetId) {
    fields.push("content_id");
  }
  if (route.learningObjectId !== expected.learningObjectId) {
    fields.push("learningObjectId");
  }
  if (route.lensId !== expected.lensId) {
    fields.push("lensId");
  }

  return fields;
}

/** Logs local-source alignment results and reports whether every route matched. */
function logTryoutGraphIdentityAlignment(result: TryoutGraphIdentityAlignment) {
  log(
    `Checked ${result.checkedRoutes} try-out routes against local source projections`
  );

  if (result.mismatches.length === 0) {
    logSuccess(
      "All persisted try-out graph IDs match local source projections"
    );
    return true;
  }

  logError(
    `${result.mismatches.length} persisted try-out routes have source-misaligned graph IDs:`
  );
  for (const mismatch of result.mismatches.slice(0, 5)) {
    log(`  - ${mismatch}`);
  }
  if (result.mismatches.length > 5) {
    log(`  ... and ${result.mismatches.length - 5} more`);
  }

  return false;
}

/** Logs persisted graph integrity gates and reports whether every gate passed. */
function logPersistedGraphIdentity(
  graphIdentity: PersistedGraphIdentityIntegrity
) {
  let allMatch = true;

  log(
    `Checked ${graphIdentity.checkedRefs} graph refs and ${graphIdentity.checkedRefInputs} Nakafa content_ref inputs across ${graphIdentity.scannedRows} persisted rows`
  );

  if (graphIdentity.missingGraphRows === 0) {
    logSuccess("All persisted content refs include graph identity fields");
  } else {
    logError(
      `${graphIdentity.missingGraphRows} persisted content refs are missing graph identity fields`
    );
    if (graphIdentity.firstMissingGraph) {
      log(
        `  First missing graph ref: ${JSON.stringify(graphIdentity.firstMissingGraph)}`
      );
    }
    allMatch = false;
  }

  if (graphIdentity.routeShapedContentIds === 0) {
    logSuccess("No persisted content refs use route-shaped content_id values");
  } else {
    logError(
      `${graphIdentity.routeShapedContentIds} persisted content refs still use route-shaped content_id values`
    );
    if (graphIdentity.firstRouteShapedContentId) {
      log(
        `  First route-shaped content_id: ${JSON.stringify(graphIdentity.firstRouteShapedContentId)}`
      );
    }
    allMatch = false;
  }

  if (graphIdentity.invalidRefInputs === 0) {
    logSuccess(
      "All persisted Nakafa content_ref inputs use graph IDs, resource URIs, or canonical URLs"
    );
  } else {
    logError(
      `${graphIdentity.invalidRefInputs} persisted Nakafa content_ref inputs are invalid`
    );
    if (graphIdentity.firstInvalidRefInput) {
      log(
        `  First invalid content_ref input: ${JSON.stringify(graphIdentity.firstInvalidRefInput)}`
      );
    }
    allMatch = false;
  }

  if (graphIdentity.mismatchedContentIds === 0) {
    logSuccess("All persisted content refs use assetId as content_id");
  } else {
    logError(
      `${graphIdentity.mismatchedContentIds} persisted content refs have content_id values that differ from assetId`
    );
    if (graphIdentity.firstMismatchedContentId) {
      log(
        `  First mismatched content_id: ${JSON.stringify(graphIdentity.firstMismatchedContentId)}`
      );
    }
    allMatch = false;
  }

  return allMatch;
}
