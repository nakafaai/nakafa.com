import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { requireAssessment } from "@repo/backend/convex/assessments/helpers/access";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const reorderDirectionValidator = literals("up", "down");

/** Reorder one authored assessment within its current school/class scope. */
export const reorderAssessment = mutation({
  args: {
    schoolId: vv.id("schools"),
    assessmentId: vv.id("schoolAssessments"),
    direction: reorderDirectionValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const assessment = await requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: assessment.schoolId,
      classId: assessment.classId,
    });

    const adjacentAssessment = assessment.classId
      ? await findAdjacentClassAssessment(ctx, assessment, args.direction)
      : await findAdjacentSchoolAssessment(ctx, assessment, args.direction);

    if (!adjacentAssessment) {
      return null;
    }

    const now = Date.now();

    await Promise.all([
      ctx.db.patch("schoolAssessments", assessment._id, {
        order: adjacentAssessment.order,
        updatedAt: now,
      }),
      ctx.db.patch("schoolAssessments", adjacentAssessment._id, {
        order: assessment.order,
        updatedAt: now,
      }),
    ]);

    return null;
  },
});

/** Find the adjacent authored assessment in one class-scoped list. */
function findAdjacentClassAssessment(
  ctx: MutationCtx,
  assessment: Doc<"schoolAssessments">,
  direction: "up" | "down"
) {
  if (!assessment.classId) {
    return null;
  }

  if (direction === "up") {
    return ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_classId_and_order", (q) =>
        q
          .eq("schoolId", assessment.schoolId)
          .eq("classId", assessment.classId)
          .lt("order", assessment.order)
      )
      .order("desc")
      .first();
  }

  return ctx.db
    .query("schoolAssessments")
    .withIndex("by_schoolId_and_classId_and_order", (q) =>
      q
        .eq("schoolId", assessment.schoolId)
        .eq("classId", assessment.classId)
        .gt("order", assessment.order)
    )
    .order("asc")
    .first();
}

/** Find the adjacent authored assessment in one school-scoped list. */
function findAdjacentSchoolAssessment(
  ctx: MutationCtx,
  assessment: Doc<"schoolAssessments">,
  direction: "up" | "down"
) {
  if (direction === "up") {
    return ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_order", (q) =>
        q.eq("schoolId", assessment.schoolId).lt("order", assessment.order)
      )
      .order("desc")
      .first();
  }

  return ctx.db
    .query("schoolAssessments")
    .withIndex("by_schoolId_and_order", (q) =>
      q.eq("schoolId", assessment.schoolId).gt("order", assessment.order)
    )
    .order("asc")
    .first();
}
