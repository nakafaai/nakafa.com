import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { LearningContextStorage } from "@repo/backend/confect/contents/context";
import { toContentViewIoError } from "@repo/backend/confect/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/confect/contents/views/target";
import { Effect, Struct } from "effect";

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
    route: ContentViewTarget,
    context: LearningContextStorage,
    input: {
      readonly lastViewedAt: number;
      readonly userId: Docs["users"]["_id"];
    }
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const existing = yield* database
      .table("userLearningRecents")
      .get("by_userId_and_content_id", input.userId, route.content_id)
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
    const row = {
      alignmentId: route.alignmentId,
      assetId: route.assetId,
      conceptId: route.conceptId,
      content_id: route.content_id,
      ...context,
      ...Struct.pick(route, ["description"]),
      lastViewedAt: input.lastViewedAt,
      learningObjectId: route.learningObjectId,
      lensId: route.lensId,
      locale: route.locale,
      ...(route.kind === "curriculum-lesson"
        ? {
            materialDomain: route.materialDomain,
          }
        : {}),
      route: route.route,
      section: route.section,
      sourcePath: route.sourcePath,
      title: route.title,
      userId: input.userId,
    };
    if (!existing) {
      yield* writer.table("userLearningRecents").insert(row);
      return;
    }
    yield* writer.table("userLearningRecents").patch(existing._id, {
      ...row,
      ...toContextPatch(context),
      description: route.description,
      materialDomain:
        route.kind === "curriculum-lesson" ? route.materialDomain : undefined,
    });
  },
  Effect.mapError(toContentViewIoError)
);
