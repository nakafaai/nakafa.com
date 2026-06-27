import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { LearningContextStorage } from "@repo/backend/convex/contents/context";
import {
  ContentViewIoError,
  contentViewIoFailedCode,
} from "@repo/backend/convex/contents/views/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/** Maps thrown Convex IO failures into the content-view error channel. */
function toRecentIoError(error: unknown) {
  return new ContentViewIoError({
    code: contentViewIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Builds a patch that also clears stale optional context fields. */
function toContextPatch(context: LearningContextStorage) {
  return {
    contextKey: context.contextKey,
    contextMaterialKey: context.contextMaterialKey,
    contextMode: context.contextMode,
    contextNodeKey: context.contextNodeKey,
    contextParentPath: context.contextParentPath,
    contextProgramKey: context.contextProgramKey,
    contextPublicPath: context.contextPublicPath,
    contextSourcePath: context.contextSourcePath,
  };
}

/** Upserts the signed-in learner's canonical recent content read-model row. */
export const upsertUserRecent = Effect.fn("contents.views.upsertUserRecent")(
  function* (
    db: MutationCtx["db"],
    route: Doc<"contentRoutes">,
    context: LearningContextStorage,
    input: {
      readonly lastViewedAt: number;
      readonly userId: Doc<"users">["_id"];
    }
  ) {
    const existing = yield* Effect.tryPromise({
      try: () =>
        db
          .query("userLearningRecents")
          .withIndex("by_userId_and_content_id", (q) =>
            q.eq("userId", input.userId).eq("content_id", route.content_id)
          )
          .unique(),
      catch: toRecentIoError,
    });
    const row = {
      alignmentId: route.alignmentId,
      assetId: route.assetId,
      conceptId: route.conceptId,
      content_id: route.content_id,
      ...context,
      description: route.description,
      lastViewedAt: input.lastViewedAt,
      learningObjectId: route.learningObjectId,
      lensId: route.lensId,
      locale: route.locale,
      materialDomain: route.materialDomain,
      route: route.route,
      section: route.section,
      sourcePath: route.sourcePath,
      title: route.title,
      userId: input.userId,
    };

    if (!existing) {
      yield* Effect.tryPromise({
        try: () => db.insert("userLearningRecents", row),
        catch: toRecentIoError,
      });
      return;
    }

    yield* Effect.tryPromise({
      try: () =>
        db.patch("userLearningRecents", existing._id, {
          ...row,
          ...toContextPatch(context),
        }),
      catch: toRecentIoError,
    });
  }
);
