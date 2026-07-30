import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
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
});

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
    yield* requireMaterialState(active, locale);
    return { active, managed: true };
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
  const family = yield* loadMaterialOwner(ctx, locale);
  if (!(family.active && !family.managed)) {
    return family;
  }
  const owner = yield* loadContentOwner(
    ctx,
    contentKey,
    locale,
    family.active.sequence
  );
  if (owner && owner.family !== "material") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material ${contentKey}/${locale} changed ownership family.`
    );
  }
  if (owner?.managed) {
    yield* requireMaterialState(family.active, locale);
  }
  return {
    active: family.active,
    managed: owner?.managed === true,
  };
});
