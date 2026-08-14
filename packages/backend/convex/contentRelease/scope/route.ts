import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
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
  rawAppLocale: Doc<"contentPaths">["appLocale"],
  publicPath: string
) {
  const appLocale = yield* Schema.decodeUnknown(AppLocaleSchema)(
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
  const artifactLocale = yield* Schema.decodeUnknown(ArtifactLocaleSchema)(
    rawAppLocale
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Route locale ${rawAppLocale} cannot identify its current routed artifact.`,
        })
    )
  );
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return {
      active,
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
    return { active, managed, projection: null };
  }
  if (!binding || binding.operation === "delete") {
    return { active, managed, projection: null };
  }
  if (!binding.contentKey) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${appLocale}/${publicPath} lost its content identity.`
    );
  }
  const projection = yield* resolvePublicProjection(
    ctx,
    binding.contentKey,
    artifactLocale,
    active.sequence
  );
  if (
    !projection ||
    projection.family !== family ||
    projection.publicPath !== publicPath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${appLocale}/${publicPath} lost its ${family} projection.`
    );
  }

  return { active, managed, projection };
});
