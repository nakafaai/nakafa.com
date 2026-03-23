import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

const SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE = 100;

/** Deletes one deleted class's member rows in bounded batches. */
export const cleanupDeletedClassMembers = internalMutation({
  args: {
    classId: vv.id("schoolClasses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const classMembers = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) => q.eq("classId", args.classId))
      .take(SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE);

    for (const member of classMembers) {
      await ctx.db.delete("schoolClassMembers", member._id);
    }

    if (classMembers.length < SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.triggers.schools.cleanup.cleanupDeletedClassMembers,
      args
    );

    return null;
  },
});
