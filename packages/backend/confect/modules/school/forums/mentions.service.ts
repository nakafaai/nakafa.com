import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  getClassMembership,
  getSchoolMembership,
  isAdmin,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { MAX_FORUM_POST_MENTIONS } from "@repo/backend/confect/modules/school/forums/constants";
import { Effect } from "effect";

type DatabaseCtx = ConvexMutationCtx | ConvexQueryCtx;

/** Validates that mentioned users can access the forum. */
export const validateForumMentions = Effect.fn(
  "school.forums.validateForumMentions"
)(function* (
  ctx: DatabaseCtx,
  args: {
    readonly forum: Doc<"schoolClassForums">;
    readonly mentionedUserIds: readonly Id<"users">[];
  }
) {
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
      ctx,
      args.forum.classId,
      mentionedUserId
    );

    if (classMember) {
      continue;
    }

    const schoolMember = yield* getSchoolMembership(
      ctx,
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
