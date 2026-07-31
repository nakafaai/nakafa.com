import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { hasExactMaterialOwnerWork } from "@repo/backend/convex/contentRelease/material/readiness";
import { hasMaterialReadModel } from "@repo/backend/convex/contentRelease/material/state";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { Effect } from "effect";

type ActiveIdentity = Exclude<
  Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>,
  null
>;

/** Requires the active material read model to match its publication identity. */
export const requireMaterialState = Effect.fn(
  "contentRelease.requireMaterialState"
)(function* (active: ActiveIdentity, locale: Doc<"contentKeys">["locale"]) {
  if (!hasMaterialReadModel(active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Materials for ${locale} in active release ${active.releaseId} are still synchronizing.`
    );
  }
});

/** Loads active material catalog readiness independently of family ownership. */
export const loadMaterialCatalogOwner = Effect.fn(
  "contentRelease.loadMaterialCatalogOwner"
)(function* (ctx: QueryCtx) {
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return { active: null, familyManaged: false, ready: false };
  }
  const families = yield* loadReleaseFamilies(active.release);
  const familyManaged = families.result.includes("material");
  const ready = hasMaterialReadModel(active);
  const exactPending =
    !ready && (yield* hasExactMaterialOwnerWork(ctx, active.releaseId));
  if (!ready && (familyManaged || exactPending)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Materials in active release ${active.releaseId} are still synchronizing.`
    );
  }
  return { active, familyManaged, ready };
});

/** Loads material ownership only after its active read model is complete. */
export const loadMaterialOwner = Effect.fn("contentRelease.loadMaterialOwner")(
  function* (ctx: QueryCtx, locale: Doc<"contentKeys">["locale"]) {
    const owner = yield* loadMaterialCatalogOwner(ctx);
    if (!(owner.active && owner.familyManaged)) {
      return { active: owner.active, managed: false };
    }
    yield* requireMaterialState(owner.active, locale);
    return { active: owner.active, managed: true };
  }
);

/** Resolves material ownership by stable identity when no route binding exists. */
export const loadMaterialIdentityOwner = Effect.fn(
  "contentRelease.loadMaterialIdentityOwner"
)(function* (
  ctx: QueryCtx,
  contentKey: string,
  locale: Doc<"contentKeys">["locale"]
) {
  const catalog = yield* loadMaterialCatalogOwner(ctx);
  if (!catalog.active) {
    return { active: null, exactManaged: false, managed: false };
  }
  const owner = yield* loadContentOwner(
    ctx,
    contentKey,
    locale,
    catalog.active.sequence
  );
  if (owner && owner.family !== "material") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material ${contentKey}/${locale} changed ownership family.`
    );
  }
  if (catalog.familyManaged) {
    return {
      active: catalog.active,
      exactManaged: false,
      managed: true,
    };
  }
  const exactManaged = owner?.managed === true;
  if (exactManaged) {
    yield* requireMaterialState(catalog.active, locale);
  }
  return {
    active: catalog.active,
    exactManaged,
    managed: exactManaged,
  };
});
