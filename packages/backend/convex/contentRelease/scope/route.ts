import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjectionProof } from "@repo/backend/convex/contentRelease/catalog";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect, Schema } from "effect";
/** Resolves one public route from the exact active publication sequence. */
export const resolveActiveRoute = Effect.fn(
  "contentRelease.resolveActiveRoute"
)(function* (
  ctx: QueryCtx,
  family: ContentFamily,
  rawAppLocale: string,
  publicPath: string
) {
  const appLocale = yield* Schema.decodeUnknownEffect(AppLocaleSchema)(
    rawAppLocale
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Route locale ${rawAppLocale} violates the current application-locale contract.`,
        })
    )
  );
  const artifactLocale = ArtifactLocaleSchema.make(appLocale);
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return {
      active,
      head: null,
      managed: false,
      projection: null,
    };
  }
  const families = yield* loadReleaseFamilies(active.release);
  const binding = yield* loadRouteBinding(
    ctx,
    appLocale,
    publicPath,
    active.sequence
  );
  const managed = families.result.includes(family);
  if (!managed) {
    return { active, head: null, managed, projection: null };
  }
  if (!binding || binding.operation === "delete") {
    return { active, head: null, managed, projection: null };
  }
  if (!binding.contentKey) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${appLocale}/${publicPath} lost its content identity.`
    );
  }
  const proof = yield* resolvePublicProjectionProof(
    ctx,
    binding.contentKey,
    artifactLocale,
    active.sequence
  );
  if (
    !proof ||
    proof.projection.family !== family ||
    proof.projection.publicPath !== publicPath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${appLocale}/${publicPath} lost its ${family} projection.`
    );
  }
  return { active, head: proof.head, managed, projection: proof.projection };
});
