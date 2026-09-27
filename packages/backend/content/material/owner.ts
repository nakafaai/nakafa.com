import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { hasMaterialReadModel } from "@repo/backend/confect/contentRelease/material/state";
import { loadReleaseFamilies } from "@repo/backend/confect/contentRelease/scope/family";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { Effect } from "effect";

type ActiveIdentity = Exclude<
  Effect.Success<ReturnType<typeof loadActiveIdentity>>,
  null
>;
/** Requires the active material read model to match its publication identity. */
export const requireMaterialState = Effect.fn(
  "contentRelease.requireMaterialState"
)(function* (
  active: ActiveIdentity,
  appLocale: Docs["contentPaths"]["appLocale"]
) {
  if (!hasMaterialReadModel(active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Materials for ${appLocale} in active release ${active.releaseId} are still synchronizing.`
    );
  }
  return active.state.materialSlot;
});
/** Loads active material catalog readiness and family ownership. */
export const loadMaterialCatalogOwner = Effect.fn(
  "contentRelease.loadMaterialCatalogOwner"
)(function* () {
  const active = yield* loadActiveIdentity();
  if (!active) {
    return {
      active: null,
      managed: false,
      ready: false,
      slot: null,
    };
  }
  const families = yield* loadReleaseFamilies(active.release);
  const managed = families.result.includes("material");
  const ready = hasMaterialReadModel(active);
  if (!ready && managed) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Materials in active release ${active.releaseId} are still synchronizing.`
    );
  }
  return {
    active,
    managed,
    ready,
    slot: ready ? active.state.materialSlot : null,
  };
});
/** Loads material ownership only after its active read model is complete. */
export const loadMaterialOwner = Effect.fn("contentRelease.loadMaterialOwner")(
  function* (appLocale: Docs["contentPaths"]["appLocale"]) {
    const owner = yield* loadMaterialCatalogOwner();
    if (!(owner.active && owner.managed)) {
      return {
        active: owner.active,
        managed: false,
        slot: null,
      };
    }
    const slot = yield* requireMaterialState(owner.active, appLocale);
    return {
      active: owner.active,
      managed: true,
      slot,
    };
  }
);
