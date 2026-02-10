/**
 * School membership helpers.
 *
 * Check school membership and admin status.
 */
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";

/**
 * Check if user is a school admin.
 * Admins have full access to all classes in their school.
 */
export function isAdmin(
  membership: Doc<"schoolMembers"> | null | undefined
): boolean {
  return membership?.role === "admin";
}

/**
 * Get active school membership for a user.
 * Returns null if user is not an active member.
 */
export async function getSchoolMembership(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("schoolMembers")
    .withIndex("schoolId_userId_status", (q) =>
      q.eq("schoolId", schoolId).eq("userId", userId).eq("status", "active")
    )
    .unique();
}
