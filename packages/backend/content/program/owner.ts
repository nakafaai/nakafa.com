import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { hasMaterialReadModel } from "@repo/backend/confect/contentRelease/material/state";
import { loadReleaseFamilies } from "@repo/backend/confect/contentRelease/scope/family";
import { loadActiveSnapshot } from "@repo/backend/content/publication/snapshot";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { Array as Arr, Effect } from "effect";

/** Loads one coherent program snapshot and active material catalog owner. */
export const loadProgramOwner = Effect.fn("contentRelease.loadProgramOwner")(
  function* (appLocale: PublicationRow<"contentPaths">["appLocale"]) {
    const selected = yield* loadActiveSnapshot("program");
    if (!selected) {
      return {
        managed: false,
        selected: null,
      };
    }
    const families = yield* loadReleaseFamilies(selected.active.release);
    if (!Arr.contains(families.result, "material")) {
      return {
        managed: false,
        selected,
      };
    }
    const { active } = selected;
    if (!hasMaterialReadModel(active)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Programs for ${appLocale} in active release ${active.releaseId} are waiting for materials.`
      );
    }
    return {
      managed: true,
      selected,
    };
  }
);
