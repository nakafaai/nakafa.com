import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyStoredProtectedContentRuntimeExchange } from "@nakafa/aksara-history/history/decode";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  decodeHistorySnapshotJson,
  parseHistoryJson,
} from "@repo/backend/convex/tryouts/history/decode";
import {
  loadRetainedTryoutInventory,
  type RetainedTryoutInventory,
} from "@repo/backend/convex/tryouts/history/inventory";
import {
  historyAuditValidator,
  historyFail,
  historyIntegrity,
  historyRead,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect, Schema } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

const RetainedArtifactSelectorSchema = Schema.Struct({
  artifactHash: Schema.String,
  payload: Schema.Struct({
    contentKey: Schema.String,
    locale: Schema.Literal("en", "id"),
  }),
});

/** Authenticates one retained release, renderer, and immutable artifact. */
const authenticateBundle = Effect.fn("tryouts.history.authenticateBundle")(
  function* (
    ctx: ReadCtx,
    inventory: RetainedTryoutInventory,
    bundle: RetainedTryoutInventory["bundles"][number],
    plan: RetainedTryoutHistoryPlan
  ) {
    const expected = plan.releases.find(
      ({ releaseId }) => releaseId === bundle.releaseId
    );
    const attempt = inventory.attempts.find(
      ({ snapshotReleaseId }) => snapshotReleaseId === bundle.releaseId
    );
    const frozen = attempt
      ? inventory.frozenPlacements.find(
          ({ tryoutAttemptId }) => tryoutAttemptId === attempt._id
        )
      : undefined;
    if (!(expected && attempt && frozen)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained bundle ${bundle.releaseId} has no accepted attempt-owned artifact.`
      );
    }

    const storedArtifact = yield* historyRead(
      "Unable to read a retained bundle artifact.",
      () =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (query) =>
            query.eq("artifactHash", frozen.questionArtifactHash)
          )
          .unique()
    );
    if (!storedArtifact) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `Retained bundle ${bundle.releaseId} lost its authenticated artifact.`
      );
    }

    const [release, rendererManifest, artifact] = yield* Effect.all([
      parseHistoryJson(bundle.releaseJson, `Release ${bundle.releaseId}`),
      parseHistoryJson(bundle.rendererJson, `Renderer ${bundle.releaseId}`),
      parseHistoryJson(
        storedArtifact.artifactJson,
        `Artifact ${frozen.questionArtifactHash}`
      ),
    ]);
    const artifactSelector = yield* Schema.decodeUnknown(
      RetainedArtifactSelectorSchema
    )(artifact).pipe(
      Effect.mapError(() =>
        historyIntegrity(
          `Retained bundle ${bundle.releaseId} has no usable artifact selector.`
        )
      )
    );
    if (
      artifactSelector.artifactHash !== frozen.questionArtifactHash ||
      artifactSelector.payload.contentKey !== frozen.questionContentKey
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained bundle ${bundle.releaseId} lost its signed artifact selection.`
      );
    }
    const artifactLocale = artifactSelector.payload.locale;
    const separator = artifactSelector.payload.contentKey.lastIndexOf("/");
    if (separator < 1) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained bundle ${bundle.releaseId} has an invalid artifact content key.`
      );
    }
    const contentRoot = artifactSelector.payload.contentKey.slice(0, separator);
    const contentBody = artifactSelector.payload.contentKey.slice(
      separator + 1
    );
    const request = {
      appLocale: attempt.locale,
      attemptId: attempt._id,
      selectors: [
        {
          artifactHash: frozen.questionArtifactHash,
          artifactLocale,
          contentKey: frozen.questionContentKey,
          delivery: "authenticated",
        },
      ],
      snapshotId: plan.snapshotId,
      snapshotReleaseId: expected.releaseId,
    };
    const response = {
      appLocale: attempt.locale,
      attemptId: attempt._id,
      items: [
        {
          artifact,
          delivery: "authenticated",
          sourcePath: `packages/corpus/${contentRoot}/${contentBody}.${artifactLocale}.mdx`,
        },
      ],
      kind: "found",
      release,
      rendererManifest,
      snapshotId: plan.snapshotId,
      snapshotManifestHash: expected.manifestHash,
      snapshotReleaseId: expected.releaseId,
    };
    const authenticated = yield* verifyStoredProtectedContentRuntimeExchange({
      rendererManifest,
      request,
      response,
    }).pipe(
      Effect.mapError((error) =>
        historyIntegrity(
          `Retained bundle ${bundle.releaseId} failed authentication: ${error._tag}.`
        )
      )
    );

    const authenticatedItem =
      authenticated.kind === "found" ? authenticated.items[0] : undefined;
    const tryoutState =
      authenticated.kind === "found"
        ? authenticated.release.manifest.snapshots.tryout
        : undefined;
    if (
      authenticated.kind !== "found" ||
      !authenticatedItem ||
      authenticated.release.manifest.releaseId !== expected.releaseId ||
      authenticated.release.manifestHash !== expected.manifestHash ||
      bundle.manifestHash !== expected.manifestHash ||
      bundle.snapshotId !== plan.snapshotId ||
      tryoutState?.resultSnapshotId !== plan.snapshotId ||
      authenticatedItem.artifact.payload.rendererDomain !==
        frozen.rendererDomain
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained bundle ${bundle.releaseId} failed its exact signed identity.`
      );
    }
  }
);

/** Authenticates the retained self-addressed historical snapshot manifest. */
const authenticateSnapshot = Effect.fn("tryouts.history.authenticateSnapshot")(
  function* (
    inventory: RetainedTryoutInventory,
    plan: RetainedTryoutHistoryPlan
  ) {
    const manifest = yield* decodeHistorySnapshotJson(
      inventory.snapshot.snapshotJson,
      plan.snapshotId
    );
    const catalogRowCount = Object.values(manifest.counts).reduce(
      (total, count) => total + count,
      0
    );
    if (
      manifest.snapshotId !== plan.snapshotId ||
      inventory.snapshot.snapshotId !== plan.snapshotId ||
      manifest.format !== plan.format ||
      catalogRowCount !== plan.catalogRowCount ||
      manifest.placementCount !== plan.placementRowCount
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained snapshot ${plan.snapshotId} failed its exact manifest identity.`
      );
    }
  }
);

/** Authenticates all exact retained bytes before any history operation. */
export const authenticateRetainedTryoutHistory = Effect.fn(
  "tryouts.history.authenticateRetainedTryoutHistory"
)(function* (ctx: ReadCtx, plan: RetainedTryoutHistoryPlan) {
  const inventory = yield* loadRetainedTryoutInventory(ctx, plan);
  const seenBundles = new Set<string>();
  for (const bundle of inventory.bundles) {
    if (seenBundles.has(bundle.releaseId)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained release ${bundle.releaseId} has duplicate bundles.`
      );
    }
    seenBundles.add(bundle.releaseId);
  }
  for (const release of plan.releases) {
    if (!seenBundles.has(release.releaseId)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `Retained release ${release.releaseId} has no bundle.`
      );
    }
  }
  yield* Effect.forEach(inventory.bundles, (bundle) =>
    authenticateBundle(ctx, inventory, bundle, plan)
  );
  yield* authenticateSnapshot(inventory, plan);
  return inventory;
});

/** Read-only operator gate for the exact production inventory and old bytes. */
export const audit = internalQuery({
  args: {},
  returns: historyAuditValidator,
  handler: (ctx) =>
    runConvexProgram(
      authenticateRetainedTryoutHistory(ctx, retainedTryoutHistoryPlan).pipe(
        Effect.map((inventory) => ({
          attempts: inventory.attempts.length,
          bundles: inventory.bundles.length,
          frozenPlacements: inventory.frozenPlacements.length,
          progressRows: inventory.progressRows.length,
          snapshotId: inventory.snapshot.snapshotId,
        })),
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
