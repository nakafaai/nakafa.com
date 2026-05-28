import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import {
  isAdmin,
  loadActiveClass,
  requireClassAccess,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type { SchoolClassForumTag } from "@repo/backend/confect/modules/school/classes.tables";
import {
  loadActiveForumWithAccess,
  loadOpenForumWithAccess,
} from "@repo/backend/confect/modules/school/forums/access.service";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/confect/modules/school/forums/aggregates";
import { resolveForumAttachmentUploads } from "@repo/backend/confect/modules/school/forums/attachments.service";
import {
  MAX_FORUM_POST_ATTACHMENTS,
  MAX_FORUM_REACTION_VARIANTS,
  MIN_FORUM_THREAD_TEXT_LENGTH,
  STUDENT_FORUM_TAGS,
} from "@repo/backend/confect/modules/school/forums/constants";
import { validateForumMentions } from "@repo/backend/confect/modules/school/forums/mentions.service";
import { notifyForumPostParticipants } from "@repo/backend/confect/modules/school/forums/postNotifications.service";
import {
  truncateText,
  updateForumReadState,
} from "@repo/backend/confect/modules/school/forums/posts.service";
import {
  applyForumReactionDelta,
  validateForumReactionValue,
} from "@repo/backend/confect/modules/school/forums/reactions.service";
import { Clock, Effect, Option } from "effect";

/** Creates a class forum thread. */
export const createForum = Effect.fn("school.forums.createForum")(
  function* (args: {
    body: string;
    classId: Id<"schoolClasses">;
    tag: SchoolClassForumTag;
    title: string;
  }) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();
    const userId = user.appUser._id;
    const classData = yield* loadActiveClass(args.classId);
    const title = args.title.trim();
    const body = args.body.trim();

    if (title.length < MIN_FORUM_THREAD_TEXT_LENGTH) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum title must be at least three characters long.",
        })
      );
    }

    if (body.length < MIN_FORUM_THREAD_TEXT_LENGTH) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum description must be at least three characters long.",
        })
      );
    }

    const access = yield* requireClassAccess(
      args.classId,
      classData.schoolId,
      userId
    );
    const canCreateManagedForumTag =
      isAdmin(access.schoolMembership) ||
      access.classMembership?.role === "teacher";

    if (
      !(
        canCreateManagedForumTag ||
        STUDENT_FORUM_TAGS.some((tag) => tag === args.tag)
      )
    ) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "You do not have access to create this forum tag.",
        })
      );
    }

    const now = yield* Clock.currentTimeMillis;

    return yield* writer.table("schoolClassForums").insert({
      body,
      classId: args.classId,
      createdBy: userId,
      isPinned: false,
      lastPostAt: now,
      lastPostBy: userId,
      nextPostSequence: 1,
      postCount: 0,
      reactionCounts: [],
      schoolId: classData.schoolId,
      status: "open",
      tag: args.tag,
      title,
      updatedAt: now,
    });
  }
);

/** Creates a forum post with optional attachments and mentions. */
export const createForumPost = Effect.fn("school.forums.createForumPost")(
  function* (args: {
    attachmentUploadIds?: readonly Id<"schoolClassForumPendingUploads">[];
    body: string;
    forumId: Id<"schoolClassForums">;
    mentions?: readonly Id<"users">[];
    parentId?: Id<"schoolClassForumPosts">;
  }) {
    const ctx = yield* MutationCtx;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();
    const userId = user.appUser._id;
    const attachmentUploadIds = args.attachmentUploadIds ?? [];

    if (attachmentUploadIds.length > MAX_FORUM_POST_ATTACHMENTS) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum post attachment count exceeds the supported limit.",
        })
      );
    }

    if (!(args.body.trim().length > 0 || attachmentUploadIds.length > 0)) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Post must have either a message or attachments.",
        })
      );
    }

    const { forum } = yield* loadOpenForumWithAccess(args.forumId, userId);
    const attachments = yield* resolveForumAttachmentUploads({
      forumId: args.forumId,
      uploadIds: attachmentUploadIds,
      userId,
    });
    const mentions = yield* validateForumMentions({
      forum,
      mentionedUserIds: args.mentions ?? [],
    });
    let replyToBody: string | undefined;
    let replyToUserId: Id<"users"> | undefined;

    if (args.parentId) {
      const parentId = args.parentId;
      const parentPost = yield* reader
        .table("schoolClassForumPosts")
        .get(parentId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

      if (!parentPost || parentPost.forumId !== args.forumId) {
        return yield* Effect.fail(
          new ClassActionError({ message: "Parent post not found." })
        );
      }

      replyToBody = truncateText({ text: parentPost.body });
      replyToUserId = parentPost.createdBy;
    }

    const now = yield* Clock.currentTimeMillis;
    const sequence = forum.nextPostSequence;
    yield* writer.table("schoolClassForums").patch(forum._id, {
      nextPostSequence: sequence + 1,
    });
    const postId = yield* writer.table("schoolClassForumPosts").insert({
      body: args.body,
      classId: forum.classId,
      createdBy: userId,
      forumId: args.forumId,
      mentions,
      parentId: args.parentId,
      reactionCounts: [],
      replyCount: 0,
      replyToBody,
      replyToUserId,
      sequence,
      updatedAt: now,
    });
    const post = yield* reader
      .table("schoolClassForumPosts")
      .get(postId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!post) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Created forum post not found." })
      );
    }

    const aggregatePost = {
      _creationTime: post._creationTime,
      _id: post._id,
      createdBy: post.createdBy,
      forumId: post.forumId,
      sequence: post.sequence,
    };
    yield* Effect.promise(() =>
      forumPostsBySequence.insert(ctx, aggregatePost)
    );
    yield* Effect.promise(() =>
      forumPostsByAuthorSequence.insert(ctx, aggregatePost)
    );
    yield* writer.table("schoolClassForums").patch(forum._id, {
      lastPostAt: post._creationTime,
      lastPostBy: userId,
      postCount: forum.postCount + 1,
      updatedAt: now,
    });
    yield* updateForumReadState({
      classId: forum.classId,
      forumId: forum._id,
      lastReadSequence: post.sequence,
      userId,
    });

    const parentId = args.parentId;

    if (parentId) {
      const parentPost = yield* reader
        .table("schoolClassForumPosts")
        .get(parentId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

      if (parentPost) {
        yield* writer.table("schoolClassForumPosts").patch(parentId, {
          replyCount: parentPost.replyCount + 1,
          updatedAt: now,
        });
      }
    }

    yield* notifyForumPostParticipants({ forum, post });

    for (const attachment of attachments) {
      yield* writer.table("schoolClassForumPostAttachments").insert({
        classId: forum.classId,
        createdBy: userId,
        fileId: attachment.storageId,
        forumId: args.forumId,
        mimeType: attachment.mimeType,
        name: attachment.name,
        postId,
        size: attachment.size,
      });
      yield* writer
        .table("schoolClassForumPendingUploads")
        .delete(attachment._id);
    }

    return postId;
  }
);

/** Toggles a reaction on a forum thread. */
export const toggleForumReaction = Effect.fn(
  "school.forums.toggleForumReaction"
)(function* (args: { emoji: string; forumId: Id<"schoolClassForums"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const emoji = yield* validateForumReactionValue(args.emoji);
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const { forum } = yield* loadActiveForumWithAccess(args.forumId, userId);
  const existingReaction = yield* reader
    .table("schoolClassForumReactions")
    .index("by_forumId_and_userId_and_emoji", (query) =>
      query.eq("forumId", args.forumId).eq("userId", userId).eq("emoji", emoji)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (existingReaction) {
    yield* writer
      .table("schoolClassForumReactions")
      .delete(existingReaction._id);
    yield* writer.table("schoolClassForums").patch(forum._id, {
      reactionCounts: applyForumReactionDelta(forum.reactionCounts, emoji, -1),
    });
    return { added: false };
  }

  const hasReactionVariant = forum.reactionCounts.some(
    (reactionCount) => reactionCount.emoji === emoji
  );

  if (
    !hasReactionVariant &&
    forum.reactionCounts.length >= MAX_FORUM_REACTION_VARIANTS
  ) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "Forum reaction variants exceed the supported limit.",
      })
    );
  }

  yield* writer.table("schoolClassForumReactions").insert({
    emoji,
    forumId: args.forumId,
    userId,
  });
  yield* writer.table("schoolClassForums").patch(forum._id, {
    reactionCounts: applyForumReactionDelta(forum.reactionCounts, emoji, 1),
  });

  return { added: true };
});

/** Toggles a reaction on a forum post. */
export const togglePostReaction = Effect.fn("school.forums.togglePostReaction")(
  function* (args: { emoji: string; postId: Id<"schoolClassForumPosts"> }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const emoji = yield* validateForumReactionValue(args.emoji);
    const user = yield* requireAppUser();
    const userId = user.appUser._id;
    const post = yield* reader
      .table("schoolClassForumPosts")
      .get(args.postId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () =>
          Effect.fail(new ClassActionError({ message: "Post not found." }))
        )
      );

    yield* loadActiveForumWithAccess(post.forumId, userId);
    const existingReaction = yield* reader
      .table("schoolClassForumPostReactions")
      .index("by_postId_and_userId_and_emoji", (query) =>
        query.eq("postId", args.postId).eq("userId", userId).eq("emoji", emoji)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (existingReaction) {
      yield* writer
        .table("schoolClassForumPostReactions")
        .delete(existingReaction._id);
      yield* writer.table("schoolClassForumPosts").patch(post._id, {
        reactionCounts: applyForumReactionDelta(post.reactionCounts, emoji, -1),
      });
      return { added: false };
    }

    const hasReactionVariant = post.reactionCounts.some(
      (reactionCount) => reactionCount.emoji === emoji
    );

    if (
      !hasReactionVariant &&
      post.reactionCounts.length >= MAX_FORUM_REACTION_VARIANTS
    ) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Forum post reaction variants exceed the supported limit.",
        })
      );
    }

    yield* writer.table("schoolClassForumPostReactions").insert({
      emoji,
      postId: args.postId,
      userId,
    });
    yield* writer.table("schoolClassForumPosts").patch(post._id, {
      reactionCounts: applyForumReactionDelta(post.reactionCounts, emoji, 1),
    });

    return { added: true };
  }
);

/** Marks a forum read through a post boundary. */
export const markForumRead = Effect.fn("school.forums.markForumRead")(
  function* (args: {
    forumId: Id<"schoolClassForums">;
    lastReadPostId: Id<"schoolClassForumPosts">;
  }) {
    const reader = yield* DatabaseReader;
    const user = yield* requireAppUser();
    const userId = user.appUser._id;
    const { forum } = yield* loadActiveForumWithAccess(args.forumId, userId);
    const lastReadPost = yield* reader
      .table("schoolClassForumPosts")
      .get(args.lastReadPostId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!lastReadPost || lastReadPost.forumId !== args.forumId) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Read boundary post not found." })
      );
    }

    yield* updateForumReadState({
      classId: forum.classId,
      forumId: args.forumId,
      lastReadSequence: lastReadPost.sequence,
      userId,
    });

    return null;
  }
);
