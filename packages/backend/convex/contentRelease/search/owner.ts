import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

/** Loads active ownership only when the public search model is fully synced. */
export const loadSearchOwner = Effect.fn("contentRelease.loadSearchOwner")(
  function* (ctx: QueryCtx) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return null;
    }
    const { state } = active;
    if (
      state.searchManifestHash !== active.manifestHash ||
      state.searchReleaseId !== active.releaseId ||
      state.searchSequence !== active.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Search for active release ${active.releaseId} is still synchronizing.`
      );
    }
    const families = yield* loadReleaseFamilies(active.release);
    return {
      families: families.result,
      manifestHash: active.manifestHash,
      releaseId: active.releaseId,
      sequence: active.sequence,
    };
  }
);
