import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";

/** Load all banks visible to one school, optionally scoped to one class. */
export async function listVisibleQuestionBanks(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  classId?: Id<"schoolClasses">
) {
  const schoolBanks = await ctx.db
    .query("schoolAssessmentQuestionBanks")
    .withIndex("by_schoolId_and_scope", (q) =>
      q.eq("schoolId", schoolId).eq("scope", "school")
    )
    .collect();

  if (!classId) {
    return schoolBanks;
  }

  const classBanks = await ctx.db
    .query("schoolAssessmentQuestionBanks")
    .withIndex("by_schoolId_and_classId", (q) =>
      q.eq("schoolId", schoolId).eq("classId", classId)
    )
    .collect();

  return [...schoolBanks, ...classBanks];
}
