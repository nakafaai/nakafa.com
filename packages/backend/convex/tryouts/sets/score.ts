import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  compactPage,
  isReadyTrackSet,
  projectSet,
  readOrderedSetPage,
  readSetProgress,
} from "@repo/backend/convex/tryouts/sets/catalog";
import type { ListArgs } from "@repo/backend/convex/tryouts/sets/spec";
import { ConvexError } from "convex/values";

type User = Doc<"users">;

interface ScoreCursor {
  readonly phase: "scored" | "unscored";
  readonly value: string | null;
}

const SCORED_CURSOR_PREFIX = "scored:";
const UNSCORED_CURSOR_PREFIX = "unscored:";

/** Lists scored sets globally before appending stable unscored rows. */
export async function listScoreSortedSets(
  ctx: QueryCtx,
  args: ListArgs,
  user: User
) {
  const cursor = decodeScoreCursor(args.paginationOpts.cursor);

  if (cursor.phase === "scored") {
    return await readScoredSets(ctx, args, user, cursor.value);
  }

  return await readUnscoredSets(ctx, args, user, cursor.value);
}

/** Reads one indexed score page and transitions to unscored rows at its end. */
async function readScoredSets(
  ctx: QueryCtx,
  args: ListArgs,
  user: User,
  cursor: string | null
) {
  const page = await ctx.db
    .query("tryoutSetProgress")
    .withIndex(
      "by_userId_and_track_and_publishedScore_and_setKey",
      (query) =>
        query
          .eq("userId", user._id)
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", args.trackKey)
          .eq("locale", args.locale)
          .gt("publishedScore", null)
    )
    .order(args.sort.direction)
    .paginate({ ...args.paginationOpts, cursor });
  const rows = await Promise.all(
    page.page.map(async (progress) => {
      const set = await ctx.db.get(progress.tryoutSetId);

      if (!isReadyTrackSet(set, args)) {
        return null;
      }

      return await projectSet(ctx, set, progress);
    })
  );
  const result = compactPage(page, rows);
  const continueCursor = page.isDone
    ? encodeScoreCursor({ phase: "unscored", value: null })
    : encodeScoreCursor({ phase: "scored", value: page.continueCursor });

  return { continueCursor, isDone: false, page: result.page };
}

/** Reads authored-order rows that do not yet have a persisted score. */
async function readUnscoredSets(
  ctx: QueryCtx,
  args: ListArgs,
  user: User,
  cursor: string | null
) {
  const page = await readOrderedSetPage(ctx, {
    ...args,
    direction: "asc",
    paginationOpts: { ...args.paginationOpts, cursor },
  });
  const rows = await Promise.all(
    page.page.map(async (set) => {
      const progress = await readSetProgress(ctx, user, set);

      if (progress && progress.publishedScore !== null) {
        return null;
      }

      return await projectSet(ctx, set, progress);
    })
  );
  const result = compactPage(page, rows);

  if (page.isDone) {
    return result;
  }

  return {
    ...result,
    continueCursor: encodeScoreCursor({
      phase: "unscored",
      value: page.continueCursor,
    }),
  };
}

/** Encodes one phase without interpreting Convex's opaque inner cursor. */
function encodeScoreCursor(cursor: ScoreCursor) {
  const prefix =
    cursor.phase === "scored" ? SCORED_CURSOR_PREFIX : UNSCORED_CURSOR_PREFIX;

  return `${prefix}${cursor.value ?? ""}`;
}

/** Decodes the score pagination phase or rejects an invalid client cursor. */
function decodeScoreCursor(cursor: string | null): ScoreCursor {
  if (cursor === null) {
    return { phase: "scored", value: null };
  }

  if (cursor.startsWith(SCORED_CURSOR_PREFIX)) {
    return {
      phase: "scored",
      value: readInnerCursor(cursor, SCORED_CURSOR_PREFIX),
    };
  }

  if (cursor.startsWith(UNSCORED_CURSOR_PREFIX)) {
    return {
      phase: "unscored",
      value: readInnerCursor(cursor, UNSCORED_CURSOR_PREFIX),
    };
  }

  throw new ConvexError({
    code: "INVALID_TRYOUT_SCORE_CURSOR",
    message: "The try-out score pagination cursor is invalid.",
  });
}

/** Reads an optional opaque cursor after its validated phase prefix. */
function readInnerCursor(cursor: string, prefix: string) {
  const value = cursor.slice(prefix.length);
  return value.length === 0 ? null : value;
}
