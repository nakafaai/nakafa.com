import { schoolClassForumTagValidator } from "@repo/backend/convex/classes/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Create a new forum inside a class.
 */
export const createForum = mutation({
  args: {
    body: v.string(),
    classId: vv.id("schoolClasses"),
    tag: schoolClassForumTagValidator,
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const classData = await loadActiveClass(ctx, args.classId);
    await requireClassAccess(ctx, args.classId, classData.schoolId, userId);

    const now = Date.now();

    return ctx.db.insert("schoolClassForums", {
      body: args.body,
      classId: args.classId,
      createdBy: userId,
      isPinned: false,
      lastPostAt: now,
      lastPostBy: userId,
      postCount: 0,
      reactionCounts: [],
      schoolId: classData.schoolId,
      status: "open",
      tag: args.tag,
      title: args.title,
      updatedAt: now,
    });
  },
});
