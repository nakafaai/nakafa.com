import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadReleaseFamilies } from "@repo/backend/confect/contentRelease/scope/family";
import { resolveBoundPublicProjection } from "@repo/backend/content/publication/projection";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { PublicationSource } from "@repo/backend/content/publication/source";
import type { routeResultValidator } from "@repo/backend/content/publication/spec";
import { Effect, Option, type Schema } from "effect";
/** Resolves one public route from the exact active publication sequence. */
export const resolveActiveRoute = Effect.fn(
  "contentRelease.resolveActiveRoute"
)(function* (
  family: ContentFamily,
  rawAppLocale: Docs["contentPaths"]["appLocale"],
  publicPath: string
) {
  const appLocale = AppLocaleSchema.make(rawAppLocale);
  const active = yield* loadActiveIdentity();
  if (!active) {
    return {
      active,
      managed: false,
      projection: null,
    };
  }
  const families = yield* loadReleaseFamilies(active.release);
  const binding = Option.getOrNull(
    yield* (yield* PublicationSource).binding(
      appLocale,
      publicPath,
      active.sequence
    )
  );
  const managed = families.result.includes(family);
  if (!managed) {
    return {
      active,
      managed,
      projection: null,
    };
  }
  if (!binding || binding.operation === "delete") {
    return {
      active,
      managed,
      projection: null,
    };
  }
  if (!binding.contentKey) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${appLocale}/${publicPath} lost its content identity.`
    );
  }
  const projection = yield* resolveBoundPublicProjection(
    binding,
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
  return {
    active,
    managed,
    projection,
  };
});
type RouteResult = Schema.Schema.Type<typeof routeResultValidator>;
/** Converts the internal route model into its public ownership contract. */
function toRouteResult(
  resolved: Effect.Success<ReturnType<typeof resolveActiveRoute>>
): RouteResult {
  if (!resolved.active) {
    return {
      activeReleaseId: null,
      kind: "unmanaged",
    };
  }
  if (!resolved.managed) {
    return {
      activeReleaseId: resolved.active.releaseId,
      kind: "unmanaged",
    };
  }
  if (!resolved.projection) {
    return {
      activeReleaseId: resolved.active.releaseId,
      kind: "missing",
    };
  }
  return {
    activeReleaseId: resolved.active.releaseId,
    kind: "found",
    projectionJson: resolved.projection.projectionJson,
  };
}

/** Returns public ownership without exposing artifact code. */
export const readRouteOwnership = Effect.fn(
  "contentRelease.readRouteOwnership"
)(
  (
    family: ContentFamily,
    appLocale: Docs["contentPaths"]["appLocale"],
    publicPath: string
  ) =>
    resolveActiveRoute(family, appLocale, publicPath).pipe(
      Effect.map(toRouteResult)
    )
);
