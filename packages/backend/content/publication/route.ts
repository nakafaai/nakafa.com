import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { PublicationSource } from "@repo/backend/content/publication/source";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect, Option } from "effect";
/** Resolves one public route from the exact active publication sequence. */
export const resolveActiveRoute = Effect.fn(
  "contentRelease.resolveActiveRoute"
)(function* (
  family: ContentFamily,
  rawAppLocale: Doc<"contentPaths">["appLocale"],
  publicPath: string
) {
  const appLocale = AppLocaleSchema.make(rawAppLocale);
  const artifactLocale = ArtifactLocaleSchema.make(rawAppLocale);
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

export const routeResultValidator = v.union(
  v.object({
    activeReleaseId: v.union(v.string(), v.null()),
    kind: v.literal("unmanaged"),
  }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("missing"),
  }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("found"),
    projectionJson: v.string(),
  })
);
type RouteResult = Infer<typeof routeResultValidator>;
/** Converts the internal route model into its public ownership contract. */
function toRouteResult(
  resolved: Effect.Success<ReturnType<typeof resolveActiveRoute>>
): RouteResult {
  if (!resolved.active) {
    return { activeReleaseId: null, kind: "unmanaged" };
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
    appLocale: Doc<"contentPaths">["appLocale"],
    publicPath: string
  ) =>
    resolveActiveRoute(family, appLocale, publicPath).pipe(
      Effect.map(toRouteResult)
    )
);
