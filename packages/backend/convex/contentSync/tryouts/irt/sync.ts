import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { provisionIrtScale } from "@repo/backend/convex/contentSync/tryouts/irt/provision";
import {
  irtScaleMatchesSnapshot,
  loadIrtSetSnapshot,
  loadLatestIrtScale,
} from "@repo/backend/convex/contentSync/tryouts/irt/snapshot";
import type { IrtSyncProof } from "@repo/backend/convex/contentSync/tryouts/irt/spec";
import { ConvexError } from "convex/values";

type TryoutSet = Doc<"tryoutSets">;

/** Provisions a provisional IRT scale from the exact synced question snapshot. */
export async function syncIrtScaleForSet(
  ctx: MutationCtx,
  args: { proof: IrtSyncProof; set: TryoutSet; syncedAt: number }
) {
  if (args.set.scoringStrategy !== "irt") {
    return;
  }

  const proof = requireSetProof(args.proof, args.set);
  const snapshot = await loadIrtSetSnapshot(ctx, args.set);

  if (!snapshot) {
    return;
  }

  const currentScale = await loadLatestIrtScale(ctx, args.set._id);

  if (
    currentScale &&
    currentScale.tryoutSnapshotId === proof.snapshotId &&
    currentScale.setIdentity === proof.setIdentity &&
    (await irtScaleMatchesSnapshot(ctx, {
      proof,
      scaleId: currentScale._id,
      snapshot,
      totalQuestionCount: args.set.totalQuestionCount,
    }))
  ) {
    return;
  }

  await provisionIrtScale(ctx, {
    proof,
    set: args.set,
    snapshot,
    syncedAt: args.syncedAt,
  });
}

/** Selects the exact proof root matching one synchronized IRT set. */
function requireSetProof(proof: IrtSyncProof, set: TryoutSet) {
  const setIdentity = tryoutCatalogIdentity({ ...set, kind: "set" });
  const resolved = proof.sets.find(
    (candidate) => candidate.setIdentity === setIdentity
  );

  if (!resolved) {
    throw new ConvexError({
      code: "TRYOUT_IRT_PROOF_MISSING",
      message: `Missing signed IRT proof for set ${setIdentity}.`,
    });
  }

  return resolved;
}
