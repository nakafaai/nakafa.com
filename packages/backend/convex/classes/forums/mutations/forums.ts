import {
  MIN_FORUM_THREAD_TEXT_LENGTH,
  STUDENT_FORUM_TAGS,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { schoolClassForumTagValidator } from "@repo/backend/convex/classes/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { isAdmin } from "@repo/backend/convex/lib/helpers/school";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

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
  returns: vv.id("schoolClassForums"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;
    const classData = await loadActiveClass(ctx, args.classId);
    const title = args.title.trim();
    const body = args.body.trim();

    if (title.length < MIN_FORUM_THREAD_TEXT_LENGTH) {
      throw new ConvexError({
        code: "FORUM_TITLE_TOO_SHORT",
        message: "Forum title must be at least three characters long.",
      });
    }

    if (body.length < MIN_FORUM_THREAD_TEXT_LENGTH) {
      throw new ConvexError({
        code: "FORUM_BODY_TOO_SHORT",
        message: "Forum description must be at least three characters long.",
      });
    }

    const { classMembership, schoolMembership } = await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      userId
    );
    const canCreateManagedForumTag =
      isAdmin(schoolMembership) || classMembership?.role === "teacher";

    if (
      !(
        canCreateManagedForumTag ||
        STUDENT_FORUM_TAGS.some((tag) => tag === args.tag)
      )
    ) {
      throw new ConvexError({
        code: "FORUM_TAG_ACCESS_DENIED",
        message: "You do not have access to create this forum tag.",
      });
    }

    const now = Date.now();

    return ctx.db.insert("schoolClassForums", {
      body,
      classId: args.classId,
      createdBy: userId,
      isPinned: false,
      lastPostAt: now,
      lastPostBy: userId,
      nextPostSequence: 1,
      postCount: 0,
      reactionCounts: [],
      schoolId: classData.schoolId,
      status: "open",
      tag: args.tag,
      title,
      updatedAt: now,
    });
  },
});
