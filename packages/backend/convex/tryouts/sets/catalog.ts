import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/progress";
import {
  loadReadySections,
  toPublicTryoutSet,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import type {
  ListArgs,
  StatusArgs,
  TrackIdentity,
  UnattemptedArgs,
} from "@repo/backend/convex/tryouts/sets/spec";
import type { PaginationResult } from "convex/server";

type TryoutSet = Doc<"tryoutSets">;
type TryoutSetProgress = Doc<"tryoutSetProgress">;
type User = Doc<"users">;
type OrderedSetPageArgs = TrackIdentity & {
  direction: ListArgs["sort"]["direction"];
  paginationOpts: ListArgs["paginationOpts"];
};

/** Returns whether every catalog parent for one track is active and ready. */
export async function readReadyTrackParent(
  ctx: QueryCtx,
  identity: TrackIdentity
) {
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

/** Reads the compact latest progress row for one user and set. */
export async function readSetProgress(
  ctx: QueryCtx,
  user: User,
  set: TryoutSet
) {
  return await ctx.db
    .query("tryoutSetProgress")
    .withIndex("by_userId_and_tryoutSetId", (q) =>
      q.eq("userId", user._id).eq("tryoutSetId", set._id)
    )
    .unique();
}

/** Projects one set only while its section snapshot remains ready. */
export async function projectSet(
  ctx: QueryCtx,
  set: TryoutSet,
  progress: TryoutSetProgress | null
) {
  if (!(await loadReadySections(ctx, set))) {
    return null;
  }

  return {
    ...toPublicTryoutSet(set),
    attemptStatus: progress?.status ?? null,
    publishedScore: progress?.publishedScore ?? null,
  };
}

/** Reads one page using the selected catalog-owned index. */
async function readCatalogPage(ctx: QueryCtx, args: ListArgs) {
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

  return await readOrderedSetPage(ctx, {
    ...args,
    direction: args.sort.direction,
  });
}

/** Reads one ready set page in source-owned order. */
export async function readOrderedSetPage(
  ctx: QueryCtx,
  args: OrderedSetPageArgs
) {
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
    .order(args.direction)
    .paginate(args.paginationOpts);
}

/** Lists catalog-sorted sets with compact user progress point reads. */
export async function listCatalogSets(
  ctx: QueryCtx,
  args: ListArgs,
  user: User | null
) {
  const page = await readCatalogPage(ctx, args);
  const rows = await Promise.all(
    page.page.map(async (set) => {
      const progress = user ? await readSetProgress(ctx, user, set) : null;
      return await projectSet(ctx, set, progress);
    })
  );

  return compactPage(page, rows);
}

/** Lists one exact attempted state using the user progress status index. */
export async function listSetsByStatus(
  ctx: QueryCtx,
  args: StatusArgs,
  user: User
) {
  const page = await ctx.db
    .query("tryoutSetProgress")
    .withIndex("by_userId_and_track_and_statusRank_and_setKey", (q) =>
      q
        .eq("userId", user._id)
        .eq("countryKey", args.countryKey)
        .eq("examKey", args.examKey)
        .eq("trackKey", args.trackKey)
        .eq("locale", args.locale)
        .eq("statusRank", getTryoutStatusRank(args.status))
    )
    .order("asc")
    .paginate(args.paginationOpts);
  const rows = await Promise.all(
    page.page.map(async (progress) => {
      const set = await ctx.db.get(progress.tryoutSetId);

      if (!isReadyTrackSet(set, args)) {
        return null;
      }

      return await projectSet(ctx, set, progress);
    })
  );

  return compactPage(page, rows);
}

/** Lists ready sets with no progress row for the current user. */
export async function listUnattemptedSets(
  ctx: QueryCtx,
  args: UnattemptedArgs,
  user: User | null
) {
  const page = await readOrderedSetPage(ctx, {
    ...args,
    direction: "asc",
  });
  const rows = await Promise.all(
    page.page.map(async (set) => {
      const progress = user ? await readSetProgress(ctx, user, set) : null;

      if (progress) {
        return null;
      }

      return await projectSet(ctx, set, null);
    })
  );

  return compactPage(page, rows);
}

/** Narrow a candidate set to the active ready row for one track identity. */
export function isReadyTrackSet(
  set: TryoutSet | null,
  identity: TrackIdentity
): set is TryoutSet {
  return Boolean(
    set?.isActive &&
      set.isReady &&
      set.countryKey === identity.countryKey &&
      set.examKey === identity.examKey &&
      set.trackKey === identity.trackKey &&
      set.locale === identity.locale
  );
}

/** Remove omitted rows while preserving Convex pagination metadata. */
export function compactPage<TDocument, TRow>(
  page: PaginationResult<TDocument>,
  rows: (TRow | null)[]
): PaginationResult<TRow> {
  return {
    ...page,
    page: rows.flatMap((row) => (row ? [row] : [])),
  };
}
