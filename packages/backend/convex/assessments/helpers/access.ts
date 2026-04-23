import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

/** Assert that one authored assessment exists for the given school. */
export async function requireAssessment(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  assessmentId: Id<"schoolAssessments">
) {
  const assessment = await ctx.db.get("schoolAssessments", assessmentId);

  if (!assessment || assessment.schoolId !== schoolId) {
    throw new ConvexError({
      code: "ASSESSMENT_NOT_FOUND",
      message: `Assessment not found for assessmentId: ${assessmentId}`,
    });
  }

  return assessment;
}
