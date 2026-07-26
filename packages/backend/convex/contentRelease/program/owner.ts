import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

/** Loads one coherent program snapshot and active material catalog owner. */
export const loadProgramOwner = Effect.fn("contentRelease.loadProgramOwner")(
  function* (ctx: QueryCtx, locale: Doc<"contentKeys">["locale"]) {
    const selected = yield* loadActiveSnapshot(ctx, "program");
    if (!selected) {
      return { managed: false, selected: null };
    }
    const families = yield* loadReleaseFamilies(selected.active.release);
    if (!families.result.includes("material")) {
      return { managed: false, selected };
    }
    const { active } = selected;
    if (
      active.state.materialManifestHash !== active.manifestHash ||
      active.state.materialReleaseId !== active.releaseId ||
      active.state.materialSequence !== active.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Programs for ${locale} in active release ${active.releaseId} are waiting for materials.`
      );
    }
    return { managed: true, selected };
  }
);
