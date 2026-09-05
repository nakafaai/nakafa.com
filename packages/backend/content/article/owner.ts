import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

/** Loads article ownership only after its active read model is complete. */
export const loadArticleOwner = Effect.fn("contentRelease.loadArticleOwner")(
  function* (appLocale: PublicationRow<"contentPaths">["appLocale"]) {
    const active = yield* loadActiveIdentity();
    if (!active) {
      return { active: null, managed: false, slot: null };
    }
    const families = yield* loadReleaseFamilies(active.release);
    if (!families.result.includes("article")) {
      return { active, managed: false, slot: null };
    }
    if (
      active.state.articleManifestHash !== active.manifestHash ||
      active.state.articleReleaseId !== active.releaseId ||
      active.state.articleSequence !== active.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Articles for ${appLocale} in active release ${active.releaseId} are still synchronizing.`
      );
    }
    return { active, managed: true, slot: active.state.articleSlot };
  }
);
