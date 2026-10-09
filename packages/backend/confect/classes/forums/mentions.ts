import type { Docs } from "@repo/backend/confect/_generated/docs";
import { checkClassAccess } from "@repo/backend/confect/classes/access";
import { MAX_FORUM_POST_MENTIONS } from "@repo/backend/confect/classes/forums/constants";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect } from "effect";

/** Only mention viewers who can currently read this forum's class. */
export const validateForumMentions = Effect.fn(
  "classes.forums.mentions.validate"
)(function* ({
  forum,
  mentionedUserIds,
}: {
  forum: Docs["schoolClassForums"];
  mentionedUserIds: readonly Id<"users">[];
}) {
  const uniqueMentionedUserIds = Arr.dedupe(mentionedUserIds);
  if (uniqueMentionedUserIds.length > MAX_FORUM_POST_MENTIONS) {
    return yield* ForumError.make({
      code: "FORUM_MENTION_LIMIT_EXCEEDED",
      message: "Forum post mention count exceeds the supported limit.",
    });
  }
  for (const userId of uniqueMentionedUserIds) {
    const access = yield* checkClassAccess(
      forum.classId,
      forum.schoolId,
      userId
    );
    if (!(access.schoolMembership && access.hasAccess)) {
      return yield* ForumError.make({
        code: "INVALID_FORUM_MENTION",
        message: "Mentions must target users who can access this forum.",
      });
    }
  }
  return uniqueMentionedUserIds;
});
