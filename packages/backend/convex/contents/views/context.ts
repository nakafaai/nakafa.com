import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readProgramContext } from "@repo/backend/convex/contentRelease/program/context";
import {
  createCanonicalLearningContext,
  createContextKey,
  type LearningContextInput,
  type LearningContextStorage,
} from "@repo/backend/convex/contents/context";
import { toContentViewIoError } from "@repo/backend/convex/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/convex/contents/views/target";
import { Effect } from "effect";

interface MaterialTarget {
  readonly materialKey: string;
  readonly parentPath: string;
  readonly publicPath: string;
  readonly sourcePath: string;
}

/** Reads material facts already authenticated by the published target. */
function readPublishedMaterial(target: ContentViewTarget) {
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

/** Resolves the source-owned material row while programs remain unmanaged. */
const loadSourceMaterial = Effect.fn("contents.views.loadSourceMaterial")(
  function* (db: QueryCtx["db"], target: ContentViewTarget) {
    if (target.kind !== "curriculum-lesson") {
      return null;
    }
    const publicRoute = yield* Effect.tryPromise({
      try: () =>
        db
          .query("publicRoutes")
          .withIndex("by_locale_and_publicPath", (q) =>
            q.eq("locale", target.locale).eq("publicPath", target.route)
          )
          .unique(),
      catch: toContentViewIoError,
    });

    if (
      publicRoute?.kind !== "subject-lesson" ||
      !publicRoute.materialKey ||
      !publicRoute.parentPath ||
      !publicRoute.sourcePath
    ) {
      return null;
    }
    return {
      materialKey: publicRoute.materialKey,
      parentPath: publicRoute.parentPath,
      publicPath: publicRoute.publicPath,
      sourcePath: publicRoute.sourcePath,
    } satisfies MaterialTarget;
  }
);

/** Checks whether a curriculum context route owns the target material route. */
function matchesMaterialRoute(input: {
  readonly canonicalPath?: string;
  readonly material: MaterialTarget;
}) {
  if (!input.canonicalPath) {
    return false;
  }

  return (
    input.canonicalPath === input.material.publicPath ||
    input.canonicalPath === input.material.parentPath
  );
}

/** Projects a verified public-route context row into engagement storage fields. */
function toLearningContextStorage(input: {
  readonly context: LearningContextInput;
  readonly contextRoute: {
    readonly materialContextNodeKey?: string;
    readonly materialContextParentPath?: string;
    readonly materialContextPublicPath?: string;
    readonly programKey?: string;
  };
  readonly material: MaterialTarget;
}): LearningContextStorage {
  const nodeKey = input.contextRoute.materialContextNodeKey;
  const parentPath = input.contextRoute.materialContextParentPath;
  const programKey = input.contextRoute.programKey;
  const publicPath = input.contextRoute.materialContextPublicPath;

  if (!(nodeKey && parentPath && programKey && publicPath)) {
    return createCanonicalLearningContext();
  }

  return {
    contextKey: createContextKey({
      mode: input.context.mode,
      nodeKey,
      programKey,
    }),
    contextMaterialKey: input.material.materialKey,
    contextMode: input.context.mode,
    contextNodeKey: nodeKey,
    contextParentPath: parentPath,
    contextProgramKey: programKey,
    contextPublicPath: publicPath,
    contextSourcePath: input.material.sourcePath,
  };
}

/** Resolves placement from the active immutable program snapshot. */
const resolvePublishedContext = Effect.fn(
  "contents.views.resolvePublishedContext"
)(function* (
  ctx: QueryCtx,
  target: ContentViewTarget,
  context: LearningContextInput,
  material: MaterialTarget,
  programKey: string,
  nodeKey: string
) {
  const resolved = yield* readProgramContext(ctx, target.locale, {
    materialKey: material.materialKey,
    nodeKey,
    parentPath: material.parentPath,
    programKey,
    publicPath: material.publicPath,
  }).pipe(Effect.mapError(toContentViewIoError));
  if (!resolved.managed) {
    return { managed: false, storage: createCanonicalLearningContext() };
  }
  if (!resolved.context) {
    return { managed: true, storage: createCanonicalLearningContext() };
  }
  return {
    managed: true,
    storage: toLearningContextStorage({
      context,
      contextRoute: resolved.context.mapping,
      material,
    }),
  };
});

/**
 * Verifies optional learning context against durable public route rows.
 *
 * Invalid, stale, or non-material hints intentionally return canonical context
 * so callers do not invent curriculum placement for direct asset visits.
 */
export const resolveLearningContext = Effect.fn(
  "contents.views.context.resolveLearningContext"
)(function* (
  ctx: QueryCtx,
  target: ContentViewTarget,
  context: LearningContextInput | undefined
) {
  if (!(context?.programKey && context.nodeKey)) {
    return createCanonicalLearningContext();
  }

  const publishedMaterial = readPublishedMaterial(target);
  if (publishedMaterial) {
    const published = yield* resolvePublishedContext(
      ctx,
      target,
      context,
      publishedMaterial,
      context.programKey,
      context.nodeKey
    );
    if (published.managed) {
      return published.storage;
    }
  }
  const material = yield* loadSourceMaterial(ctx.db, target);
  if (!material) {
    return createCanonicalLearningContext();
  }

  const contextRoute = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("publicRoutes")
        .withIndex(
          "by_materialKey_and_locale_and_programKey_and_contextNodeKey",
          (q) =>
            q
              .eq("materialKey", material.materialKey)
              .eq("locale", target.locale)
              .eq("programKey", context.programKey)
              .eq("materialContextNodeKey", context.nodeKey)
        )
        .unique(),
    catch: toContentViewIoError,
  });

  if (
    !(
      contextRoute &&
      contextRoute.kind === "curriculum-context" &&
      matchesMaterialRoute({
        canonicalPath: contextRoute.canonicalPath,
        material,
      })
    )
  ) {
    return createCanonicalLearningContext();
  }

  return toLearningContextStorage({
    context,
    contextRoute,
    material,
  });
});
