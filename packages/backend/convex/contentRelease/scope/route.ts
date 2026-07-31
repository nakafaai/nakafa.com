import type {
  ContentFamily,
  ContentLocale,
} from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { Effect } from "effect";

/** Resolves one public route from the exact active publication sequence. */
export const resolveActiveRoute = Effect.fn(
  "contentRelease.resolveActiveRoute"
)(function* (
  ctx: QueryCtx,
  family: ContentFamily,
  locale: ContentLocale,
  publicPath: string
) {
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return {
      active,
      familyManaged: false,
      managed: false,
      projection: null,
    };
  }
  const families = yield* loadReleaseFamilies(active.release);
  const binding = yield* loadRouteBinding(
    ctx,
    locale,
    publicPath,
    active.sequence
  );
  const owner = binding?.contentKey
    ? yield* loadContentOwner(ctx, binding.contentKey, locale, active.sequence)
    : null;
  if (owner && owner.family !== family) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${locale}/${publicPath} changed its ${family} ownership family.`
    );
  }
  const familyManaged = families.result.includes(family);
  const managed = familyManaged || owner?.managed === true;
  if (!managed) {
    return { active, familyManaged, managed, projection: null };
  }
  if (!binding || binding.operation === "delete") {
    return { active, familyManaged, managed, projection: null };
  }
  if (!binding.contentKey) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${locale}/${publicPath} lost its content identity.`
    );
  }
  const projection = yield* resolvePublicProjection(
    ctx,
    binding.contentKey,
    locale,
    active.sequence
  );
  if (
    !projection ||
    projection.family !== family ||
    projection.publicPath !== publicPath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${locale}/${publicPath} lost its ${family} projection.`
    );
  }

  return { active, familyManaged, managed, projection };
});
