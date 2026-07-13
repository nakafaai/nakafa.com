import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  createCanonicalLearningContext,
  createContextKey,
  type LearningContextInput,
  type LearningContextStorage,
} from "@repo/backend/convex/contents/context";
import {
  ContentViewIoError,
  contentViewIoFailedCode,
} from "@repo/backend/convex/contents/views/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/** Maps thrown Convex IO failures into the content-view error channel. */
function toContextIoError(error: unknown) {
  return new ContentViewIoError({
    code: contentViewIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Resolves the public material route that corresponds to a graph route row. */
const loadPublicMaterialRoute = Effect.fn(
  "contents.views.context.loadPublicMaterialRoute"
)(function* (db: QueryCtx["db"], route: Doc<"contentRoutes">) {
  if (route.kind !== "curriculum-lesson") {
    return null;
  }

  const publicRoute = yield* Effect.tryPromise({
    try: () =>
      db
        .query("publicRoutes")
        .withIndex("by_locale_and_sourcePath", (q) =>
          q.eq("locale", route.locale).eq("sourcePath", route.sourcePath)
        )
        .unique(),
    catch: toContextIoError,
  });

  if (publicRoute?.kind !== "subject-lesson") {
    return null;
  }

  if (!publicRoute.materialKey) {
    return null;
  }

  return publicRoute;
});

/** Checks whether a curriculum context route owns the target material route. */
function matchesMaterialRoute(input: {
  readonly contextRoute: Doc<"publicRoutes">;
  readonly materialRoute: Doc<"publicRoutes">;
}) {
  const canonicalPath = input.contextRoute.canonicalPath;

  if (!canonicalPath) {
    return false;
  }

  return (
    canonicalPath === input.materialRoute.publicPath ||
    canonicalPath === input.materialRoute.parentPath
  );
}

/** Projects a verified public-route context row into engagement storage fields. */
function toLearningContextStorage(input: {
  readonly context: LearningContextInput;
  readonly contextRoute: Doc<"publicRoutes">;
  readonly materialRoute: Doc<"publicRoutes">;
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
    contextMaterialKey: input.materialRoute.materialKey,
    contextMode: input.context.mode,
    contextNodeKey: nodeKey,
    contextParentPath: parentPath,
    contextProgramKey: programKey,
    contextPublicPath: publicPath,
    contextSourcePath: input.materialRoute.sourcePath,
  };
}

/**
 * Verifies optional learning context against durable public route rows.
 *
 * Invalid, stale, or non-material hints intentionally return canonical context
 * so callers do not invent curriculum placement for direct asset visits.
 */
export const resolveLearningContext = Effect.fn(
  "contents.views.context.resolveLearningContext"
)(function* (
  db: QueryCtx["db"],
  route: Doc<"contentRoutes">,
  context: LearningContextInput | undefined
) {
  if (!(context?.programKey && context.nodeKey)) {
    return createCanonicalLearningContext();
  }

  const materialRoute = yield* loadPublicMaterialRoute(db, route);

  if (!materialRoute) {
    return createCanonicalLearningContext();
  }

  const contextRoute = yield* Effect.tryPromise({
    try: () =>
      db
        .query("publicRoutes")
        .withIndex(
          "by_materialKey_and_locale_and_programKey_and_contextNodeKey",
          (q) =>
            q
              .eq("materialKey", materialRoute.materialKey)
              .eq("locale", materialRoute.locale)
              .eq("programKey", context.programKey)
              .eq("materialContextNodeKey", context.nodeKey)
        )
        .unique(),
    catch: toContextIoError,
  });

  if (
    !(
      contextRoute &&
      contextRoute.kind === "curriculum-context" &&
      matchesMaterialRoute({ contextRoute, materialRoute })
    )
  ) {
    return createCanonicalLearningContext();
  }

  return toLearningContextStorage({
    context,
    contextRoute,
    materialRoute,
  });
});
