import { query } from "@repo/backend/convex/_generated/server";
import { listVisibleQuestionBanks } from "@repo/backend/convex/assessments/helpers/bank";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** List the visible class and school question banks for one teacher context. */
export const listQuestionBanks = query({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
  },
  returns: v.array(vv.doc("schoolAssessmentQuestionBanks")),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
      classId: args.classId,
    });

    return listVisibleQuestionBanks(ctx, args.schoolId, args.classId);
  },
});
