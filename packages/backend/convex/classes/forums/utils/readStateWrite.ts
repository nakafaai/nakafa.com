import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/convex/_generated/server";
import { shouldAdvanceForumReadBoundary } from "@repo/backend/convex/classes/forums/utils/readBoundary";

/**
 * Move a user's forum read boundary forward when the next boundary is newer.
 */
export async function updateForumReadState(
  ctx: { db: DatabaseReader & DatabaseWriter },
  args: {
    forumId: Id<"schoolClassForums">;
    classId: Id<"schoolClasses">;
    userId: Id<"users">;
    lastReadSequence: number;
  }
) {
  const existing = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("by_forumId_and_userId", (q) =>
      q.eq("forumId", args.forumId).eq("userId", args.userId)
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("schoolClassForumReadStates", {
      classId: args.classId,
      forumId: args.forumId,
      lastReadSequence: args.lastReadSequence,
      userId: args.userId,
    });

    return;
  }

  if (
    !shouldAdvanceForumReadBoundary({
      existingLastReadSequence: existing.lastReadSequence,
      nextLastReadSequence: args.lastReadSequence,
    })
  ) {
    return;
  }

  await ctx.db.patch("schoolClassForumReadStates", existing._id, {
    lastReadSequence: args.lastReadSequence,
  });
}
