import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  loadReadySections,
  publicTryoutSetValidator,
  toPublicTryoutSet,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import {
  tryoutRouteKeyValidator,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const setSortValidator = v.object({
  direction: literals("asc", "desc"),
  field: literals("order", "title", "readyQuestionCount"),
});

const trackIdentityValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: localeValidator,
  trackKey: tryoutRouteKeyValidator,
});

const listArgsValidator = v.object({
  ...trackIdentityValidator.fields,
  paginationOpts: paginationOptsValidator,
  sort: setSortValidator,
});

const trackSetValidator = v.object({
  ...publicTryoutSetValidator.fields,
  attemptStatus: v.union(v.null(), tryoutStatusValidator),
});

type ListArgs = Infer<typeof listArgsValidator>;
type TrackIdentity = Infer<typeof trackIdentityValidator>;

const emptyPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};

async function readReadyTrackParent(ctx: QueryCtx, identity: TrackIdentity) {
  const [country, exam, track] = await Promise.all([
    ctx.db
      .query("tryoutCountries")
      .withIndex("by_countryKey_and_locale", (q) =>
        q.eq("countryKey", identity.countryKey).eq("locale", identity.locale)
      )
      .unique(),
    ctx.db
      .query("tryoutExams")
      .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
        q
          .eq("countryKey", identity.countryKey)
          .eq("examKey", identity.examKey)
          .eq("locale", identity.locale)
      )
      .unique(),
    ctx.db
      .query("tryoutTracks")
      .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
        q
          .eq("countryKey", identity.countryKey)
          .eq("examKey", identity.examKey)
          .eq("trackKey", identity.trackKey)
          .eq("locale", identity.locale)
      )
      .unique(),
  ]);

  return Boolean(
    country?.isActive && exam?.isActive && track?.isActive && track.isReady
  );
}

async function readLatestAttemptStatus(
  ctx: QueryCtx,
  user: Doc<"users">,
  set: Doc<"tryoutSets">
) {
  const attempt = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
      q.eq("userId", user._id).eq("tryoutSetId", set._id)
    )
    .order("desc")
    .first();

  return attempt?.status ?? null;
}

async function readSetPage(ctx: QueryCtx, args: ListArgs) {
  if (args.sort.field === "title") {
    return await ctx.db
      .query("tryoutSets")
      .withIndex("by_track_locale_active_ready_title", (q) =>
        q
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", args.trackKey)
          .eq("locale", args.locale)
          .eq("isActive", true)
          .eq("isReady", true)
      )
      .order(args.sort.direction)
      .paginate(args.paginationOpts);
  }

  if (args.sort.field === "readyQuestionCount") {
    return await ctx.db
      .query("tryoutSets")
      .withIndex("by_track_locale_active_ready_questions", (q) =>
        q
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", args.trackKey)
          .eq("locale", args.locale)
          .eq("isActive", true)
          .eq("isReady", true)
      )
      .order(args.sort.direction)
      .paginate(args.paginationOpts);
  }

  return await ctx.db
    .query("tryoutSets")
    .withIndex("by_track_locale_active_ready_order", (q) =>
      q
        .eq("countryKey", args.countryKey)
        .eq("examKey", args.examKey)
        .eq("trackKey", args.trackKey)
        .eq("locale", args.locale)
        .eq("isActive", true)
        .eq("isReady", true)
    )
    .order(args.sort.direction)
    .paginate(args.paginationOpts);
}

/** Lists one cursor page of ready sets with server sorting and user progress. */
export const list = query({
  args: listArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const hasReadyTrackParent = await readReadyTrackParent(ctx, args);

    if (!hasReadyTrackParent) {
      return emptyPage;
    }

    const [auth, page] = await Promise.all([
      getOptionalAppUser(ctx),
      readSetPage(ctx, args),
    ]);
    const rows = await Promise.all(
      page.page.map(async (set) => {
        const [readySections, attemptStatus] = await Promise.all([
          loadReadySections(ctx, set),
          auth ? readLatestAttemptStatus(ctx, auth.appUser, set) : null,
        ]);

        if (!readySections) {
          return null;
        }

        return {
          ...toPublicTryoutSet(set),
          attemptStatus,
        };
      })
    );

    return {
      ...page,
      page: rows.flatMap((row) => (row ? [row] : [])),
    };
  },
});
