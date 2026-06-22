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
import {
  type Locale,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { cleanSlug } from "@repo/utilities/helper";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type RecentlyViewedSubject = Infer<typeof recentlyViewedSubjectValidator>;

/** Bounded Continue Learning query inputs after Convex validator decoding. */
interface ListRecentLearningArgs {
  limit?: number;
  locale: Locale;
}

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

    return recentRows.flatMap(toRecentlyViewedSubject);
  }
);

/** Returns the current user's recently viewed subjects for one locale. */
export const getRecentlyViewed = query({
  args: {
    locale: localeValidator,
    limit: vv.optional(vv.number()),
  },
  returns: vv.array(recentlyViewedSubjectValidator),
  handler: async (ctx, args): Promise<RecentlyViewedSubject[]> =>
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
function toRecentlyViewedSubject(row: Doc<"userLearningRecents">) {
  if (!row.materialDomain) {
    return [];
  }

  return [
    {
      ...toPublicContentRef(row),
      contextKey: row.contextKey,
      description: row.description ?? "",
      href: `/${cleanSlug(row.route)}${toLearningContextQuery(row)}`,
      lastViewedAt: row.lastViewedAt,
      materialDomain: row.materialDomain,
      title: row.title,
    },
  ];
}
