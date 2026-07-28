import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ContentViewRouteCollisionError,
  contentViewRouteCollisionCode,
  toContentViewIoError,
} from "@repo/backend/convex/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/convex/contents/views/target";
import { Effect } from "effect";

/** Stable material facts shared by source and curriculum route projections. */
export interface MaterialTarget {
  readonly materialKey: string;
  readonly parentPath: string;
  readonly publicPath: string;
  readonly sourcePath: string;
}

interface SourceContextInput {
  readonly nodeKey: string;
  readonly programKey: string;
}

interface SourceContextMatch {
  readonly material: MaterialTarget;
  readonly route: Doc<"publicRoutes">;
}

/** Reads material facts already authenticated by the current target. */
export function readTargetMaterial(target: ContentViewTarget) {
  if (
    target.kind !== "curriculum-lesson" ||
    !target.materialKey ||
    !target.parentPath
  ) {
    return null;
  }
  return {
    materialKey: target.materialKey,
    parentPath: target.parentPath,
    publicPath: target.route,
    sourcePath: target.sourcePath,
  } satisfies MaterialTarget;
}

/** Decodes one stable source-owned material route. */
function readSourceMaterial(
  route: Doc<"publicRoutes">,
  target: ContentViewTarget
) {
  if (
    route.kind !== "subject-lesson" ||
    route.sourcePath !== target.contentKey ||
    !route.materialKey ||
    !route.parentPath ||
    (target.materialKey !== undefined &&
      route.materialKey !== target.materialKey)
  ) {
    return null;
  }
  return {
    materialKey: route.materialKey,
    parentPath: route.parentPath,
    publicPath: route.publicPath,
    sourcePath: route.sourcePath,
  } satisfies MaterialTarget;
}

/** Loads the bounded source rows that share one stable content identity. */
const loadSourceMaterials = Effect.fn("contents.views.loadSourceMaterials")(
  function* (db: QueryCtx["db"], target: ContentViewTarget) {
    const sourceRoutes = yield* Effect.tryPromise({
      try: () =>
        db
          .query("publicRoutes")
          .withIndex("by_locale_and_sourcePath", (q) =>
            q.eq("locale", target.locale).eq("sourcePath", target.contentKey)
          )
          .take(3),
      catch: toContentViewIoError,
    });

    if (sourceRoutes.length > 2) {
      return yield* new ContentViewRouteCollisionError({
        code: contentViewRouteCollisionCode,
        message: `Public routes contain more than two ${target.locale}/${target.contentKey} source shards.`,
      });
    }

    const materials: MaterialTarget[] = [];
    for (const route of sourceRoutes) {
      const material = readSourceMaterial(route, target);
      if (!material) {
        return [];
      }
      materials.push(material);
    }

    const materialKey = materials[0]?.materialKey;
    if (
      materialKey === undefined ||
      materials.some((material) => material.materialKey !== materialKey)
    ) {
      return [];
    }
    return materials;
  }
);

/** Selects the stable source row owned by one curriculum mapping. */
function selectSourceMaterial(
  materials: readonly MaterialTarget[],
  canonicalPath: string,
  currentPath: string
) {
  const matches = materials.filter(
    (material) =>
      canonicalPath === material.publicPath ||
      canonicalPath === material.parentPath
  );
  return (
    matches.find((material) => material.publicPath === currentPath) ??
    matches[0] ??
    null
  );
}

/** Checks whether two overlapping rows resolve to the same stored placement. */
function hasSameContextOwnership(
  left: SourceContextMatch,
  right: SourceContextMatch
) {
  return (
    left.material.materialKey === right.material.materialKey &&
    left.material.sourcePath === right.material.sourcePath &&
    left.route.materialContextNodeKey === right.route.materialContextNodeKey &&
    left.route.materialContextParentPath ===
      right.route.materialContextParentPath &&
    left.route.materialContextPublicPath ===
      right.route.materialContextPublicPath &&
    left.route.programKey === right.route.programKey
  );
}

/** Selects one row only when every candidate owns the same placement. */
function selectEquivalentContext(matches: readonly SourceContextMatch[]) {
  const first = matches[0];
  if (!first) {
    return null;
  }
  if (matches.some((match) => !hasSameContextOwnership(first, match))) {
    return null;
  }
  return first;
}

/** Selects one unambiguous context/material pair from overlapping route shards. */
function selectSourceContext(
  routes: readonly Doc<"publicRoutes">[],
  materials: readonly MaterialTarget[],
  currentPath: string
) {
  const matches: SourceContextMatch[] = [];

  for (const route of routes) {
    if (route.kind !== "curriculum-context" || !route.canonicalPath) {
      return null;
    }
    const material = selectSourceMaterial(
      materials,
      route.canonicalPath,
      currentPath
    );
    if (material) {
      matches.push({ material, route });
    }
  }

  const currentMatches = matches.filter(
    ({ material }) => material.publicPath === currentPath
  );
  if (currentMatches.length > 0) {
    return selectEquivalentContext(currentMatches);
  }
  return selectEquivalentContext(matches);
}

/** Resolves one placement from bounded source-owned route shards. */
export const resolveSourceContext = Effect.fn(
  "contents.views.resolveSourceContext"
)(function* (
  ctx: QueryCtx,
  target: ContentViewTarget,
  input: SourceContextInput
) {
  const materials = yield* loadSourceMaterials(ctx.db, target);
  const sourceIdentity = materials[0];
  if (!sourceIdentity) {
    return null;
  }

  const contextRoutes = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("publicRoutes")
        .withIndex(
          "by_materialKey_and_locale_and_programKey_and_contextNodeKey",
          (q) =>
            q
              .eq("materialKey", sourceIdentity.materialKey)
              .eq("locale", target.locale)
              .eq("programKey", input.programKey)
              .eq("materialContextNodeKey", input.nodeKey)
        )
        .take(3),
    catch: toContentViewIoError,
  });

  if (contextRoutes.length > 2) {
    return yield* new ContentViewRouteCollisionError({
      code: contentViewRouteCollisionCode,
      message: `Public routes contain more than two ${target.locale}/${sourceIdentity.materialKey}/${input.programKey}/${input.nodeKey} context shards.`,
    });
  }

  return selectSourceContext(contextRoutes, materials, target.route);
});
