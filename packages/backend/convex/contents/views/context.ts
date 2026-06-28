import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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

const MAX_CONTEXT_ROUTES_PER_MATERIAL = 100;

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
)(function* (db: MutationCtx["db"], route: Doc<"contentRoutes">) {
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
        .first(),
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
  const nodeKey = input.contextRoute.nodeKey;
  const programKey = input.contextRoute.programKey;

  if (!(nodeKey && programKey)) {
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
    contextParentPath: input.contextRoute.parentPath,
    contextProgramKey: programKey,
    contextPublicPath: input.contextRoute.publicPath,
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
  db: MutationCtx["db"],
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

  const contextRoutes = yield* Effect.tryPromise({
    try: () =>
      db
        .query("publicRoutes")
        .withIndex("by_materialKey_and_locale", (q) =>
          q
            .eq("materialKey", materialRoute.materialKey)
            .eq("locale", materialRoute.locale)
        )
        .take(MAX_CONTEXT_ROUTES_PER_MATERIAL),
    catch: toContextIoError,
  });

  const contextRoute = contextRoutes.find(
    (candidate) =>
      candidate.kind === "curriculum-context" &&
      candidate.programKey === context.programKey &&
      candidate.nodeKey === context.nodeKey &&
      matchesMaterialRoute({ contextRoute: candidate, materialRoute })
  );

  if (!contextRoute) {
    return createCanonicalLearningContext();
  }

  return toLearningContextStorage({
    context,
    contextRoute,
    materialRoute,
  });
});
