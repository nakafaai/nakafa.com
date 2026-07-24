import type {
  ReleaseVerificationEvidence,
  SignedContentRelease,
} from "@nakafa/aksara-contracts/release";
import {
  ContentSnapshotKindSchema,
  hasSameContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import {
  decodeProofJson,
  decodeReleaseJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  ROLLBACK_RETENTION_MS,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type ReleaseStatus = Infer<typeof statusValidator>;

/** Proves server-recomputed evidence matches every signed release count. */
function matchesManifest(
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
    manifest.rendererContractVersion === proof.rendererContractVersion &&
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
const verifySnapshots = Effect.fn("contentRelease.commitSnapshots")(function* (
  ctx: MutationCtx,
  release: SignedContentRelease,
  now: number
) {
  for (const family of ContentSnapshotKindSchema.literals) {
    const state = release.manifest.snapshots[family];
    if (state.mode !== "replace" || state.resultSnapshotId === null) {
      continue;
    }
    const snapshotId = state.resultSnapshotId;
    const snapshot = yield* Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_family_and_snapshotId", (query) =>
          query.eq("family", family).eq("snapshotId", snapshotId)
        )
        .unique()
    );
    if (!snapshot) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Verified release lost ${family} snapshot ${snapshotId}.`
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentSnapshots", snapshot._id, {
        retainUntil: Math.max(
          snapshot.retainUntil,
          now + ROLLBACK_RETENTION_MS
        ),
        verifiedAt: snapshot.verifiedAt ?? now,
      })
    );
  }
});

/** Commits server evidence only after every staged stream passed verification. */
const commitProgram = Effect.fn("contentRelease.commitProof")(function* (
  ctx: MutationCtx,
  proofJson: string
) {
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
  if (release.status === "verified") {
    if (release.proofJson !== proofJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content release ${proof.releaseId} already owns different proof bytes.`
      );
    }
    return {
      manifestHash: signed.manifestHash,
      phase: "verified",
      releaseId: release.releaseId,
    } satisfies ReleaseStatus;
  }
  if (release.status !== "verifying") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${proof.releaseId} cannot commit proof from ${release.status}.`
    );
  }
  const now = Date.now();
  const patch = {
    proofAt: now,
    proofJson,
    status: "verified",
    updatedAt: now,
    verifiedAt: now,
  } satisfies Pick<
    Doc<"contentReleases">,
    "proofAt" | "proofJson" | "status" | "updatedAt" | "verifiedAt"
  >;
  yield* ensureDocumentSize(`Content release ${proof.releaseId}`, {
    ...release,
    ...patch,
  });
  yield* verifySnapshots(ctx, signed, now);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, patch)
  );
  return {
    manifestHash: signed.manifestHash,
    phase: "verified",
    releaseId: release.releaseId,
  } satisfies ReleaseStatus;
});

/** Commits authenticated evidence produced by the Node verifier. */
export const commitProof = internalMutation({
  args: { proofJson: v.string() },
  returns: statusValidator,
  handler: (ctx, args) => runConvexProgram(commitProgram(ctx, args.proofJson)),
});
