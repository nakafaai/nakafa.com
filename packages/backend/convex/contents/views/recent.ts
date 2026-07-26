import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { LearningContextStorage } from "@repo/backend/convex/contents/context";
import { toContentViewIoError } from "@repo/backend/convex/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/convex/contents/views/target";
import { Effect } from "effect";

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
    route: ContentViewTarget,
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
      catch: toContentViewIoError,
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
        catch: toContentViewIoError,
      });
      return;
    }

    yield* Effect.tryPromise({
      try: () =>
        db.patch("userLearningRecents", existing._id, {
          ...row,
          ...toContextPatch(context),
        }),
      catch: toContentViewIoError,
    });
  }
);
