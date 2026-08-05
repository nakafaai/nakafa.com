import {
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { getGraphIdentityIntegrity } from "@repo/backend/scripts/sync-content/convex/inspection";
import { Effect } from "effect";

type PersistedGraphIdentityIntegrity = Effect.Effect.Success<
  ReturnType<typeof getGraphIdentityIntegrity>
>;

/** Verifies graph identity invariants across persisted read models. */
export const verifyGraphIdentity = Effect.fn("sync.verifyGraphIdentity")(
  function* (config: ConvexConfig) {
    const persisted = yield* getGraphIdentityIntegrity(config);
    return logPersistedGraphIdentity(persisted);
  }
);

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
