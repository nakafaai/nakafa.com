import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { hasMaterialReadModel } from "@repo/backend/convex/contentRelease/material/state";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

type ActiveIdentity = Exclude<
  Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>,
  null
>;

/** Requires the active material read model to match its publication identity. */
export const requireMaterialState = Effect.fn(
  "contentRelease.requireMaterialState"
)(function* (
  active: ActiveIdentity,
  appLocale: Doc<"contentPaths">["appLocale"]
) {
  if (!hasMaterialReadModel(active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Materials for ${appLocale} in active release ${active.releaseId} are still synchronizing.`
    );
  }
});

/** Loads active material catalog readiness and family ownership. */
export const loadMaterialCatalogOwner = Effect.fn(
  "contentRelease.loadMaterialCatalogOwner"
)(function* (ctx: QueryCtx) {
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return { active: null, managed: false, ready: false };
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
  return { active, managed, ready };
});

/** Loads material ownership only after its active read model is complete. */
export const loadMaterialOwner = Effect.fn("contentRelease.loadMaterialOwner")(
  function* (ctx: QueryCtx, appLocale: Doc<"contentPaths">["appLocale"]) {
    const owner = yield* loadMaterialCatalogOwner(ctx);
    if (!(owner.active && owner.managed)) {
      return { active: owner.active, managed: false };
    }
    yield* requireMaterialState(owner.active, appLocale);
    return { active: owner.active, managed: true };
  }
);
