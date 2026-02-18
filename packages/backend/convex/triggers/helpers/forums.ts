import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/convex/_generated/server";

/**
 * Helper function to update forum read state (upsert pattern)
 *
 * Updates the lastReadAt timestamp for a user's forum read state.
 * Creates a new record if one doesn't exist.
 * Uses "high water mark" pattern: only updates if new value is greater.
 */
export async function updateForumReadState(
  ctx: { db: DatabaseReader & DatabaseWriter },
  args: {
    forumId: Id<"schoolClassForums">;
    classId: Id<"schoolClasses">;
    userId: Id<"users">;
    lastReadAt: number;
  }
) {
  const existing = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("forumId_userId", (q) =>
      q.eq("forumId", args.forumId).eq("userId", args.userId)
    )
    .unique();

  if (existing) {
    if (args.lastReadAt > existing.lastReadAt) {
      await ctx.db.patch("schoolClassForumReadStates", existing._id, {
        lastReadAt: args.lastReadAt,
      });
    }
  } else {
    await ctx.db.insert("schoolClassForumReadStates", {
      forumId: args.forumId,
      classId: args.classId,
      userId: args.userId,
      lastReadAt: args.lastReadAt,
    });
  }
}
