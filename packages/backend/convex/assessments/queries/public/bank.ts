import { query } from "@repo/backend/convex/_generated/server";
import { listVisibleQuestionBanks } from "@repo/backend/convex/assessments/helpers/bank";
import { loadClass } from "@repo/backend/convex/classes/utils";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

/** List the visible class and school question banks for one teacher context. */
export const listQuestionBanks = query({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
  },
  returns: v.array(vv.doc("schoolAssessmentQuestionBanks")),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const classData = args.classId ? await loadClass(ctx, args.classId) : null;

    if (classData && classData.schoolId !== args.schoolId) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      });
    }

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
      classId: classData?._id,
    });

    return listVisibleQuestionBanks(ctx, args.schoolId, classData?._id);
  },
});
