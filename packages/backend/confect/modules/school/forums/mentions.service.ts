import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  getClassMembership,
  getSchoolMembership,
  isAdmin,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type { SchoolClassForums } from "@repo/backend/confect/modules/school/classes.tables";
import { MAX_FORUM_POST_MENTIONS } from "@repo/backend/confect/modules/school/forums/constants";
import { Effect, type Schema } from "effect";

type ForumDoc = Schema.Schema.Type<typeof SchoolClassForums.Doc>;

/** Validates that mentioned users can access the forum. */
export const validateForumMentions = Effect.fn(
  "school.forums.validateForumMentions"
)(function* (args: {
  readonly forum: ForumDoc;
  readonly mentionedUserIds: readonly Id<"users">[];
}) {
  if (args.mentionedUserIds.length === 0) {
    return [];
  }

  const uniqueMentionedUserIds = [...new Set(args.mentionedUserIds)];

  if (uniqueMentionedUserIds.length > MAX_FORUM_POST_MENTIONS) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum post mention count exceeds the supported limit.",
      })
    );
  }

  for (const mentionedUserId of uniqueMentionedUserIds) {
    const classMember = yield* getClassMembership(
      args.forum.classId,
      mentionedUserId
    );

    if (classMember) {
      continue;
    }

    const schoolMember = yield* getSchoolMembership(
      args.forum.schoolId,
      mentionedUserId
    );

    if (isAdmin(schoolMember)) {
      continue;
    }

    return yield* Effect.fail(
      new ClassActionError({
        message: "Mentions must target users who can access this forum.",
      })
    );
  }

  return uniqueMentionedUserIds;
});
