"use node";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { verifyRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import {
  historyFail,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
  terminalHistoryProofValidator,
} from "@repo/backend/convex/tryouts/history/spec";
import {
  verifyTerminalFrozenPlacements,
  verifyTerminalProgress,
} from "@repo/backend/convex/tryouts/history/terminalBinding";
import { authenticateTerminalBundles } from "@repo/backend/convex/tryouts/history/terminalBundle";
import { authenticateTerminalInventory } from "@repo/backend/convex/tryouts/history/terminalInventory";
import {
  readAndAuthenticateTerminalHistory,
  readTerminalFrozenRows,
} from "@repo/backend/convex/tryouts/history/terminalRead";
import {
  makeLiveTerminalHistorySource,
  TerminalHistorySource,
} from "@repo/backend/convex/tryouts/history/terminalSource";
import { Effect } from "effect";

/** Runs one bounded, post-drain authentication over every retained family. */
export const verify = internalAction({
  args: {},
  returns: terminalHistoryProofValidator,
  handler: (ctx) =>
    runConvexActionProgram(
      proveTerminalHistory(retainedTryoutHistoryPlan).pipe(
        Effect.provideService(
          TerminalHistorySource,
          makeLiveTerminalHistorySource(ctx)
        ),
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});

/** Produces counts only from rows authenticated during this exact invocation. */
export const proveTerminalHistory = Effect.fn(
  "tryouts.history.proveTerminalHistory"
)(function* (plan: RetainedTryoutHistoryPlan) {
  const source = yield* TerminalHistorySource;
  const [identities, signedState] = yield* Effect.all([
    source.identities(),
    source.signedState(),
  ]);
  const markers = yield* verifyRetainedHistoryMarkers(
    identities.attempts,
    identities.markers,
    plan
  );
  const snapshot = signedState.snapshot;
  if (
    snapshot?.family !== "tryout" ||
    snapshot.snapshotId !== plan.snapshotId ||
    snapshot.verifiedAt === undefined
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Retained snapshot ${plan.snapshotId} is missing or unverified.`
    );
  }
  const bundles = yield* authenticateTerminalBundles(signedState.bundles, plan);
  const history = yield* readAndAuthenticateTerminalHistory(
    source,
    bundles,
    plan
  );
  const inventory = yield* authenticateTerminalInventory(
    snapshot.snapshotJson,
    history.catalogRows,
    history.placementRows,
    plan
  );
  const frozenRows = yield* readTerminalFrozenRows(source, plan);
  const frozenPlacements = yield* verifyTerminalFrozenPlacements(
    identities.attempts,
    frozenRows,
    inventory.placementByIdentity,
    plan
  );
  const progressRows = yield* verifyTerminalProgress(
    identities.attempts,
    identities.progressRows,
    plan
  );
  if (history.artifactHashes.size !== plan.artifactCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `Found ${history.artifactHashes.size} unique authenticated artifacts, expected ${plan.artifactCount}.`
    );
  }
  return {
    artifacts: history.artifactHashes.size,
    attempts: identities.attempts.length,
    bundles: bundles.length,
    catalogRows: inventory.catalogRows,
    frozenPlacements,
    markers: markers.markers,
    placementRows: inventory.placementRows,
    progressRows,
    snapshotId: snapshot.snapshotId,
  };
});
