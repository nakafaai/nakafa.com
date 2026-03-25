import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { MAX_FORUM_POST_MENTIONS } from "@repo/backend/convex/classes/forums/utils/constants";
import { isAdmin } from "@repo/backend/convex/lib/helpers/school";
import { ConvexError } from "convex/values";

/**
 * Validate forum mentions and return a deduplicated list.
 */
export async function validateForumMentions(
  ctx: MutationCtx,
  {
    forum,
    mentionedUserIds,
  }: {
    forum: Awaited<ReturnType<typeof loadForumWithAccess>>["forum"];
    mentionedUserIds: Id<"users">[];
  }
) {
  if (mentionedUserIds.length === 0) {
    return [];
  }

  const uniqueMentionedUserIds = [...new Set(mentionedUserIds)];

  if (uniqueMentionedUserIds.length > MAX_FORUM_POST_MENTIONS) {
    throw new ConvexError({
      code: "FORUM_MENTION_LIMIT_EXCEEDED",
      message: "Forum post mention count exceeds the supported limit.",
    });
  }

  const accessChecks = await Promise.all(
    uniqueMentionedUserIds.map(async (mentionedUserId) => {
      const classMember = await ctx.db
        .query("schoolClassMembers")
        .withIndex("by_classId_and_userId", (q) =>
          q.eq("classId", forum.classId).eq("userId", mentionedUserId)
        )
        .first();

      if (classMember) {
        return true;
      }

      const schoolMember = await ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_userId_and_status", (q) =>
          q
            .eq("schoolId", forum.schoolId)
            .eq("userId", mentionedUserId)
            .eq("status", "active")
        )
        .first();

      return isAdmin(schoolMember);
    })
  );

  if (accessChecks.every(Boolean)) {
    return uniqueMentionedUserIds;
  }

  throw new ConvexError({
    code: "INVALID_FORUM_MENTION",
    message: "Mentions must target users who can access this forum.",
  });
}
