"use node";

import { createHash } from "node:crypto";

import { HistoricalRendererManifestSchema } from "@nakafa/aksara-contracts/history/decode";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { verifyTryoutHistoryMigrationSource } from "@nakafa/aksara-contracts/migration/tryout/history/source";
import { TryoutHistoryMigrationSourceSchema } from "@nakafa/aksara-contracts/transport/migration/tryout/response";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN } from "@repo/backend/convex/tryouts/migration/attempt/inventory";
import { TRYOUT_HISTORY_SCALE_INVENTORY_DOMAIN } from "@repo/backend/convex/tryouts/migration/scale/inventory";
import type {
  attemptInventoryValidator,
  scaleInventoryValidator,
  sourceBytesValidator,
} from "@repo/backend/convex/tryouts/migration/source";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type AttemptInventory = Infer<typeof attemptInventoryValidator>;
type ScaleInventory = Infer<typeof scaleInventoryValidator>;
type SourceBytes = Infer<typeof sourceBytesValidator>;

const sourceBytesReference = makeFunctionReference<
  "query",
  Record<string, never>,
  SourceBytes
>("tryouts/migration/source:sourceBytes");
const attemptInventoryReference = makeFunctionReference<
  "query",
  Record<string, never>,
  AttemptInventory
>("tryouts/migration/source:attemptInventory");
const scaleInventoryReference = makeFunctionReference<
  "query",
  Record<string, never>,
  ScaleInventory
>("tryouts/migration/source:scaleInventory");

const PrivateAttemptSchema = Schema.Struct({
  attempt: Schema.Struct({
    scaleVersionId: Schema.optional(Schema.String),
    snapshotReleaseId: Schema.String,
    status: Schema.String,
    tryoutSnapshotId: Schema.String,
  }),
  marker: Schema.Struct({
    snapshotReleaseId: Schema.String,
    tryoutSnapshotId: Schema.String,
  }),
});

/** Produces a private domain-separated digest without exposing its identities. */
function digestPrivateInventory(domain: string, inventoryJson: string) {
  const digest = createHash("sha256")
    .update(domain)
    .update("\n")
    .update(inventoryJson)
    .digest("hex");
  return Sha256HashSchema.make(`sha256:${digest}`);
}

/** Parses only the private fields required to prove the retained attempt set. */
const decodePrivateAttempts = Effect.fn(
  "tryouts.migration.decodePrivateAttempts"
)((inventoryJson: string) =>
  parseStoredJson(inventoryJson, "Private try-out attempt inventory").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(Schema.Array(PrivateAttemptSchema))
    ),
    Effect.mapError(contractFailure)
  )
);

/** Verifies the private inventory against the immutable production audit. */
const verifyAttemptInventory = Effect.fn(
  "tryouts.migration.verifyAttemptInventory"
)(function* (inventory: AttemptInventory) {
  const attempts = yield* decodePrivateAttempts(inventory.inventoryJson);
  const releaseCounts = new Map<string, number>();
  let scaleAttemptCount = 0;
  for (const { attempt, marker } of attempts) {
    if (
      attempt.status === "in-progress" ||
      attempt.tryoutSnapshotId !== retainedTryoutHistoryPlan.snapshotId ||
      marker.tryoutSnapshotId !== attempt.tryoutSnapshotId ||
      marker.snapshotReleaseId !== attempt.snapshotReleaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained try-out attempt inventory changed after its audit."
      );
    }
    if (attempt.scaleVersionId !== undefined) {
      scaleAttemptCount += 1;
    }
    releaseCounts.set(
      marker.snapshotReleaseId,
      (releaseCounts.get(marker.snapshotReleaseId) ?? 0) + 1
    );
  }
  const countsMatch =
    attempts.length === retainedTryoutHistoryPlan.attemptCount &&
    inventory.attemptCount === attempts.length &&
    inventory.frozenPlacementCount ===
      retainedTryoutHistoryPlan.frozenPlacementCount &&
    inventory.progressCount === retainedTryoutHistoryPlan.progressCount &&
    scaleAttemptCount === retainedTryoutHistoryPlan.scaleAttemptCount &&
    retainedTryoutHistoryPlan.releases.every(
      ({ attemptCount, releaseId }) =>
        releaseCounts.get(releaseId) === attemptCount
    ) &&
    releaseCounts.size === retainedTryoutHistoryPlan.releases.length;
  if (!countsMatch) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out attempt counts changed after their audit."
    );
  }
});

/** Reauthenticates every immutable source identity and private aggregate. */
export const readMigrationSource = Effect.fn(
  "tryouts.migration.readSourceEvidence"
)(function* (ctx: Pick<ActionCtx, "runQuery">) {
  const { attempts, bytes, scales } = yield* Effect.all({
    attempts: callInternal(() => ctx.runQuery(attemptInventoryReference, {})),
    bytes: callInternal(() => ctx.runQuery(sourceBytesReference, {})),
    scales: callInternal(() => ctx.runQuery(scaleInventoryReference, {})),
  });
  yield* verifyAttemptInventory(attempts);
  if (scales.count !== retainedTryoutHistoryPlan.scaleVersionCount) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out scale count changed after its audit."
    );
  }
  const snapshot = yield* parseStoredJson(
    bytes.snapshotJson,
    "Retained try-out snapshot"
  );
  const rendererManifest = yield* parseStoredJson(
    bytes.rendererJson,
    "Retained try-out renderer"
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(HistoricalRendererManifestSchema)
    ),
    Effect.mapError(contractFailure)
  );
  const releases = yield* Effect.forEach(bytes.releases, (stored) =>
    parseStoredJson(stored.releaseJson, "Retained try-out release").pipe(
      Effect.map((release) => ({ attemptCount: stored.attemptCount, release }))
    )
  );
  const creatingRelease = retainedTryoutHistoryPlan.releases[0];
  if (creatingRelease === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out release audit is empty."
    );
  }
  const source = yield* Schema.decodeUnknownEffect(
    TryoutHistoryMigrationSourceSchema
  )(
    {
      evidence: {
        artifactCount: bytes.artifactCount,
        attempts: {
          attemptCount: attempts.attemptCount,
          digest: digestPrivateInventory(
            TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN,
            attempts.inventoryJson
          ),
          frozenPlacementCount: attempts.frozenPlacementCount,
          progressCount: attempts.progressCount,
          responseCount: attempts.responseCount,
          scoreCount: attempts.scoreCount,
          sectionAttemptCount: attempts.sectionAttemptCount,
        },
        catalogRowCount: bytes.catalogRowCount,
        creatingReleaseId: creatingRelease.releaseId,
        legacyBundleCount: bytes.legacyBundleCount,
        placementRowCount: bytes.placementRowCount,
        releases: retainedTryoutHistoryPlan.releases,
        rendererManifestHash: rendererManifest.hash,
        runtimeBundleCount: bytes.runtimeBundleCount,
        scales: {
          digest: digestPrivateInventory(
            TRYOUT_HISTORY_SCALE_INVENTORY_DOMAIN,
            scales.inventoryJson
          ),
          itemCount: scales.itemCount,
          runCount: scales.runCount,
          versionCount: scales.count,
        },
        snapshot,
      },
      releases,
      rendererManifest,
    },
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(contractFailure),
    Effect.flatMap(verifyTryoutHistoryMigrationSource),
    Effect.mapError(contractFailure)
  );
  const sourceMatches =
    source.evidence.snapshot.snapshotId ===
      retainedTryoutHistoryPlan.snapshotId &&
    bytes.artifactCount === retainedTryoutHistoryPlan.artifactCount &&
    bytes.catalogRowCount === retainedTryoutHistoryPlan.catalogRowCount &&
    bytes.legacyBundleCount === retainedTryoutHistoryPlan.legacyBundleCount &&
    bytes.placementRowCount === retainedTryoutHistoryPlan.placementRowCount &&
    bytes.runtimeBundleCount === retainedTryoutHistoryPlan.runtimeBundleCount;
  if (!sourceMatches) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out source bytes changed after their audit."
    );
  }
  return source;
});
