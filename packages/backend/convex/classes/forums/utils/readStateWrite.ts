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
    lastReadAt: number;
    lastReadPostId?: Id<"schoolClassForumPosts">;
  }
) {
  const existing = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("forumId_userId", (q) =>
      q.eq("forumId", args.forumId).eq("userId", args.userId)
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("schoolClassForumReadStates", {
      classId: args.classId,
      forumId: args.forumId,
      lastReadAt: args.lastReadAt,
      lastReadPostId: args.lastReadPostId,
      userId: args.userId,
    });

    return;
  }

  if (
    !(await shouldAdvanceForumReadBoundary(ctx.db, {
      existingLastReadAt: existing.lastReadAt,
      existingLastReadPostId: existing.lastReadPostId,
      forumId: args.forumId,
      nextLastReadAt: args.lastReadAt,
      nextLastReadPostId: args.lastReadPostId,
    }))
  ) {
    return;
  }

  await ctx.db.patch("schoolClassForumReadStates", existing._id, {
    lastReadAt: args.lastReadAt,
    lastReadPostId: args.lastReadPostId,
  });
}
