import { checkClassAccess } from "@repo/backend/confect/classes/access";
import { MAX_FORUM_POST_MENTIONS } from "@repo/backend/confect/classes/forums/constants";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Only mention viewers who can currently read this forum's class. */
export const validateForumMentions = Effect.fn(
  "classes.forums.mentions.validate"
)(function* (
  ctx: MutationCtx,
  {
    forum,
    mentionedUserIds,
  }: {
    forum: Doc<"schoolClassForums">;
    mentionedUserIds: readonly Id<"users">[];
  }
) {
  const uniqueMentionedUserIds = [...new Set(mentionedUserIds)];
  if (uniqueMentionedUserIds.length > MAX_FORUM_POST_MENTIONS) {
    return yield* new ForumError({
      code: "FORUM_MENTION_LIMIT_EXCEEDED",
      message: "Forum post mention count exceeds the supported limit.",
    });
  }
  for (const userId of uniqueMentionedUserIds) {
    const access = yield* checkClassAccess(
      ctx,
      forum.classId,
      forum.schoolId,
      userId
    );
    if (!(access.schoolMembership && access.hasAccess)) {
      return yield* new ForumError({
        code: "INVALID_FORUM_MENTION",
        message: "Mentions must target users who can access this forum.",
      });
    }
  }
  return uniqueMentionedUserIds;
});
