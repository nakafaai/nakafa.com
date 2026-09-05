import type { PublicationRow } from "@repo/backend/content/publication/source";
import { loadActiveSnapshot } from "@repo/backend/content/snapshot/read";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { hasMaterialReadModel } from "@repo/backend/convex/contentRelease/material/state";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

/** Loads one coherent program snapshot and active material catalog owner. */
export const loadProgramOwner = Effect.fn("contentRelease.loadProgramOwner")(
  function* (appLocale: PublicationRow<"contentPaths">["appLocale"]) {
    const selected = yield* loadActiveSnapshot("program");
    if (!selected) {
      return { managed: false, selected: null };
    }
    const families = yield* loadReleaseFamilies(selected.active.release);
    if (!families.result.includes("material")) {
      return { managed: false, selected };
    }
    const { active } = selected;
    if (!hasMaterialReadModel(active)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Programs for ${appLocale} in active release ${active.releaseId} are waiting for materials.`
      );
    }
    return { managed: true, selected };
  }
);
