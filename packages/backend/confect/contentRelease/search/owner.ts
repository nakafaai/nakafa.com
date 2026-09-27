import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadReleaseFamilies } from "@repo/backend/confect/contentRelease/scope/family";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { Effect } from "effect";

/** Loads active ownership only when the public search model is fully synced. */
export const loadSearchOwner = Effect.fn("contentRelease.loadSearchOwner")(
  function* () {
    const active = yield* loadActiveIdentity().pipe(
      Effect.provide(publicationLayer)
    );
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
      slot: state.searchSlot,
    };
  }
);
