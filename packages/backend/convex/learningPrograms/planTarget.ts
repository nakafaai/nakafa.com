import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { toContentViewIoError } from "@repo/backend/convex/contents/views/spec";
import { loadContentTarget } from "@repo/backend/convex/contents/views/target";
import { Effect } from "effect";

/** Resolves one plan sample through active ownership or a source topic route. */
export const loadLearningPlanTarget = Effect.fn(
  "learningPrograms.loadPlanTarget"
)(function* (
  ctx: QueryCtx,
  contentId: Doc<"learningProgramCoverage">["sampleContentId"],
  locale: Doc<"learningProgramCoverage">["locale"]
) {
  const source = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (query) =>
          query.eq("content_id", contentId)
        )
        .unique(),
    catch: toContentViewIoError,
  });
  const active = yield* loadContentTarget(ctx, {
    contentId,
    locale,
    ...(source ? { publicPath: source.route } : {}),
    section: source?.section ?? "material",
  });
  if (active) {
    return { route: active.route, title: active.title };
  }

  if (
    source?.kind !== "curriculum-topic" ||
    source.locale !== locale ||
    source.section !== "material"
  ) {
    return null;
  }
  return { route: source.route, title: source.title };
});
