import { DatabaseReader, DatabaseWriter } from "@confect/server";
import type {
  ReleaseVerificationEvidence,
  SignedContentRelease,
} from "@nakafa/aksara-contracts/release";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { hasSameContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import {
  decodeProofJson,
  decodeReleaseJson,
} from "@repo/backend/confect/contentRelease/parse";
import {
  ROLLBACK_RETENTION_MS,
  type statusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Effect, type Schema } from "effect";
export type ReleaseStatus = Schema.Schema.Type<typeof statusValidator>;

/** Proves server-recomputed evidence matches every signed release count. */
export function matchesManifest(
  release: SignedContentRelease,
  proof: ReleaseVerificationEvidence,
  manifestHash: string
) {
  const manifest = release.manifest;
  return (
    manifest.baseManifestHash === proof.baseManifestHash &&
    manifest.baseReleaseId === proof.baseReleaseId &&
    manifest.baseResultCount === proof.baseResultCount &&
    manifest.baseResultDigest === proof.baseResultDigest &&
    manifest.itemCount === proof.itemCount &&
    manifest.itemsDigest === proof.itemsDigest &&
    manifestHash === proof.manifestHash &&
    manifest.projectionCount === proof.projectionCount &&
    manifest.projectionDigest === proof.projectionDigest &&
    manifest.routeCount === proof.routeCount &&
    manifest.routeCount === proof.stagedRoutes &&
    manifest.routeDigest === proof.routeDigest &&
    manifest.rendererManifestHash === proof.rendererManifestHash &&
    manifest.resultCount === proof.resultCount &&
    manifest.resultDigest === proof.resultDigest &&
    manifest.rollbackCount === proof.rollbackCount &&
    manifest.rollbackDigest === proof.rollbackDigest &&
    manifest.deleteCount === proof.deleteHeads &&
    manifest.upsertCount === proof.upsertHeads &&
    manifest.upsertCount === proof.stagedArtifacts &&
    hasSameContentSnapshots(manifest.snapshots, proof.snapshots)
  );
}

/** Marks every authenticated replacement manifest as verified and retained. */
export const verifySnapshots = Effect.fn("contentRelease.commitSnapshots")(
  function* (ctx: MutationCtx, release: SignedContentRelease, now: number) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    for (const family of ContentSnapshotKindSchema.literals) {
      const state = release.manifest.snapshots[family];
      if (state.mode !== "replace" || state.resultSnapshotId === null) {
        continue;
      }
      const snapshotId = state.resultSnapshotId;
      const snapshot = yield* database
        .table("contentSnapshots")
        .get("by_family_and_snapshotId", family, snapshotId)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!snapshot) {
        return yield* releaseFail(
          "CONTENT_RELEASE_MISSING",
          `Verified release lost ${family} snapshot ${snapshotId}.`
        );
      }
      yield* writer
        .table("contentSnapshots")
        .patch(snapshot._id, {
          retainUntil: Math.max(
            snapshot.retainUntil,
            now + ROLLBACK_RETENTION_MS
          ),
          verifiedAt: snapshot.verifiedAt ?? now,
        })
        .pipe(Effect.orDie);
    }
  }
);

/** Commits server evidence only after every staged stream passed verification. */
export const commitProgram = Effect.fn("contentRelease.commitProof")(function* (
  ctx: MutationCtx,
  proofJson: string
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const proof = yield* decodeProofJson(proofJson);
  const { release } = yield* loadStaged(ctx, proof.releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const countersMatch =
    release.checkedItems === signed.manifest.itemCount &&
    release.stagedItems === signed.manifest.itemCount &&
    release.stagedProjections === signed.manifest.projectionCount &&
    release.stagedRoutes === signed.manifest.routeCount &&
    release.stagedSnapshotRows === proof.stagedSnapshotRows &&
    release.stagedArtifacts === proof.stagedArtifacts &&
    release.stagedDeletes === proof.deleteHeads &&
    release.stagedUpserts === proof.upsertHeads;
  if (!(countersMatch && matchesManifest(signed, proof, signed.manifestHash))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${proof.releaseId} proof does not match staging evidence.`
    );
  }
  if (release.proofJson !== undefined) {
    if (release.proofJson !== proofJson || release.proofAt === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content release ${proof.releaseId} already owns different proof bytes.`
      );
    }
    return {
      manifestHash: signed.manifestHash,
      phase: release.status === "verified" ? "verified" : "verifying",
      releaseId: release.releaseId,
    } satisfies ReleaseStatus;
  }
  if (release.status !== "verifying") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${proof.releaseId} cannot commit proof from ${release.status}.`
    );
  }
  const now = yield* Clock.currentTimeMillis;
  const patch = {
    proofAt: now,
    proofJson,
    updatedAt: now,
  } satisfies Pick<
    Doc<"contentReleases">,
    "proofAt" | "proofJson" | "updatedAt"
  >;
  yield* ensureDocumentSize(`Content release ${proof.releaseId}`, {
    ...release,
    ...patch,
  });
  yield* verifySnapshots(ctx, signed, now);
  yield* writer
    .table("contentReleases")
    .patch(release._id, patch)
    .pipe(Effect.orDie);
  return {
    manifestHash: signed.manifestHash,
    phase: "verifying",
    releaseId: release.releaseId,
  } satisfies ReleaseStatus;
});
