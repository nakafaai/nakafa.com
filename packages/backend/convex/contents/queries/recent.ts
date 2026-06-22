import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { toLearningContextQuery } from "@repo/backend/convex/contents/context";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { cleanSlug } from "@repo/utilities/helper";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

type RecentlyViewedSubject = Infer<typeof recentlyViewedSubjectValidator>;

/** Convex validator for bounded Continue Learning query inputs. */
const getRecentlyViewedArgs = {
  locale: localeValidator,
  limit: vv.optional(vv.number()),
};

/** Validator-owned argument contract used by the internal query program. */
const getRecentlyViewedArgsValidator = v.object(getRecentlyViewedArgs);

type ListRecentLearningArgs = Infer<typeof getRecentlyViewedArgsValidator>;

const recentLearningIoFailedCode = "RECENT_LEARNING_IO_FAILED";

/** Raised when Continue Learning cannot read its ranked model. */
class RecentLearningIoError extends Schema.TaggedError<RecentLearningIoError>()(
  "RecentLearningIoError",
  {
    code: Schema.Literal(recentLearningIoFailedCode),
    message: Schema.String,
  }
) {}

/** Maps thrown Convex IO failures into the Continue Learning error channel. */
function toRecentLearningIoError(error: unknown) {
  return new RecentLearningIoError({
    code: recentLearningIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Reads the authenticated learner's ranked Continue Learning rows. */
const listRecentLearning = Effect.fn("contents.recent.listRecentLearning")(
  function* (ctx: QueryCtx, args: ListRecentLearningArgs) {
    const limit = args.limit ?? 5;
    const user = yield* Effect.tryPromise({
      try: () => getOptionalAppUser(ctx),
      catch: toRecentLearningIoError,
    });

    if (!user) {
      return [];
    }

    const recentRows = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("userLearningRecents")
          .withIndex("by_userId_and_locale_and_section_and_lastViewedAt", (q) =>
            q
              .eq("userId", user.appUser._id)
              .eq("locale", args.locale)
              .eq("section", "material")
          )
          .order("desc")
          .take(limit),
      catch: toRecentLearningIoError,
    });

    const subjects: RecentlyViewedSubject[] = [];

    for (const row of recentRows) {
      const subject = yield* toRecentlyViewedSubject(ctx.db, row);

      if (subject) {
        subjects.push(subject);
      }
    }

    return subjects;
  }
);

/** Returns the current user's recently viewed subjects for one locale. */
export const getRecentlyViewed = query({
  args: getRecentlyViewedArgs,
  returns: vv.array(recentlyViewedSubjectValidator),
  handler: async (ctx, args) =>
    await runConvexProgram(listRecentLearning(ctx, args)),
});

/** Exposes only public content-ref fields accepted by the recent-view validator. */
function toPublicContentRef(
  route: Parameters<typeof buildContentSearchRef>[0]
) {
  const ref = buildContentSearchRef(route);

  return {
    alignmentId: ref.alignmentId,
    assetId: ref.assetId,
    conceptId: ref.conceptId,
    content_id: ref.content_id,
    learningObjectId: ref.learningObjectId,
    lensId: ref.lensId,
    locale: ref.locale,
    markdown_url: ref.markdown_url,
    route: ref.route,
    section: ref.section,
    url: ref.url,
  };
}

/** Projects one ranked recent row to the public home-card result shape. */
const toRecentlyViewedSubject = Effect.fn(
  "contents.recent.toRecentlyViewedSubject"
)(function* (db: QueryCtx["db"], row: Doc<"userLearningRecents">) {
  const route = yield* Effect.tryPromise({
    try: () =>
      db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", row.content_id))
        .unique(),
    catch: toRecentLearningIoError,
  });

  if (
    !(
      route &&
      route.locale === row.locale &&
      route.kind === "curriculum-lesson" &&
      route.materialDomain
    )
  ) {
    return;
  }

  return {
    ...toPublicContentRef(route),
    contextKey: row.contextKey,
    description: route.description ?? "",
    href: `/${cleanSlug(route.route)}${toLearningContextQuery(row)}`,
    lastViewedAt: row.lastViewedAt,
    materialDomain: route.materialDomain,
    title: route.title,
  };
});
