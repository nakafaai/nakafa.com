import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

/** Loads material ownership only after its active read model is complete. */
export const loadMaterialOwner = Effect.fn("contentRelease.loadMaterialOwner")(
  function* (ctx: QueryCtx, locale: Doc<"contentKeys">["locale"]) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return { active: null, managed: false };
    }
    const families = yield* loadReleaseFamilies(active.release);
    if (!families.result.includes("material")) {
      return { active, managed: false };
    }
    if (
      active.state.materialManifestHash !== active.manifestHash ||
      active.state.materialReleaseId !== active.releaseId ||
      active.state.materialSequence !== active.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Materials for ${locale} in active release ${active.releaseId} are still synchronizing.`
      );
    }
    return { active, managed: true };
  }
);
