import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { Effect } from "effect";

export type ProtectedMaterialRelease = Pick<
  Doc<"contentReleases">,
  "baseFamilies" | "releaseId" | "resultFamilies" | "sequence"
>;

/** Loads one complete retained recovery identity or explicit absence. */
const loadRecoveryRelease = Effect.fn(
  "contentRelease.loadProtectedMaterialRecovery"
)(function* (ctx: MutationCtx, state: Doc<"contentState"> | null) {
  if (!state || state.candidateReleaseId !== undefined) {
    return null;
  }
  const recoveryFields = [
    state.recoveryManifestHash,
    state.recoveryReleaseId,
    state.recoverySequence,
  ];
  if (recoveryFields.every((field) => field === undefined)) {
    return null;
  }
  if (
    !(state.recoveryManifestHash && state.recoveryReleaseId) ||
    state.recoverySequence === undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained recovery has a partial publication identity."
    );
  }
  const recovery = yield* loadRelease(ctx, state.recoveryReleaseId);
  if (
    recovery.role !== "recovery" ||
    recovery.status !== "verified" ||
    recovery.sequence !== state.recoverySequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Retained recovery ${state.recoveryReleaseId} lost its verified identity.`
    );
  }
  return recovery;
});

/** Loads active and retained recovery identities that protect materials. */
export const loadMaterialProtection = Effect.fn(
  "contentRelease.loadMaterialProtection"
)(function* (ctx: MutationCtx) {
  const catalog = yield* loadMaterialCatalogOwner(ctx);
  const state = catalog.active?.state ?? (yield* loadState(ctx));
  const recovery = yield* loadRecoveryRelease(ctx, state);
  return {
    active: catalog.active?.release ?? null,
    recovery,
  };
});
