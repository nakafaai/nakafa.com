import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
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
import { resolveForumAttachmentUploads } from "@repo/backend/confect/modules/school/forums/attachments.service";
import {
  MAX_FORUM_POST_ATTACHMENTS,
  MAX_FORUM_REACTION_VARIANTS,
  MIN_FORUM_THREAD_TEXT_LENGTH,
  STUDENT_FORUM_TAGS,
} from "@repo/backend/confect/modules/school/forums/constants";
import { validateForumMentions } from "@repo/backend/confect/modules/school/forums/mentions.service";
import {
  truncateText,
  updateForumReadState,
} from "@repo/backend/confect/modules/school/forums/posts.service";
import { validateForumReactionValue } from "@repo/backend/confect/modules/school/forums/reactions.service";
import { Clock, Effect } from "effect";

/** Creates a class forum thread. */
export const createForum = Effect.fn("school.forums.createForum")(
  function* (args: {
    body: string;
    classId: Id<"schoolClasses">;
    tag: SchoolClassForumTag;
    title: string;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const classData = yield* loadActiveClass(ctx, args.classId);
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
      ctx,
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

    return yield* Effect.promise(() =>
      ctx.db.insert("schoolClassForums", {
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
      })
    );
  }
);

/** Creates a forum post with optional attachments and mentions. */
export const createForumPost = Effect.fn("school.forums.createForumPost")(
  function* (args: {
    attachmentUploadIds?: Id<"schoolClassForumPendingUploads">[];
    body: string;
    forumId: Id<"schoolClassForums">;
    mentions?: Id<"users">[];
    parentId?: Id<"schoolClassForumPosts">;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
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

    const { forum } = yield* loadOpenForumWithAccess(ctx, args.forumId, userId);
    const attachments = yield* resolveForumAttachmentUploads(ctx, {
      forumId: args.forumId,
      uploadIds: attachmentUploadIds,
      userId,
    });
    const mentions = yield* validateForumMentions(ctx, {
      forum,
      mentionedUserIds: args.mentions ?? [],
    });
    let replyToBody: string | undefined;
    let replyToUserId: Id<"users"> | undefined;

    if (args.parentId) {
      const parentId = args.parentId;
      const parentPost = yield* Effect.promise(() => ctx.db.get(parentId));

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
    yield* Effect.promise(() =>
      ctx.db.patch(forum._id, {
        nextPostSequence: sequence + 1,
      })
    );
    const postId = yield* Effect.promise(() =>
      ctx.db.insert("schoolClassForumPosts", {
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
      })
    );

    for (const attachment of attachments) {
      yield* Effect.promise(() =>
        ctx.db.insert("schoolClassForumPostAttachments", {
          classId: forum.classId,
          createdBy: userId,
          fileId: attachment.storageId,
          forumId: args.forumId,
          mimeType: attachment.mimeType,
          name: attachment.name,
          postId,
          size: attachment.size,
        })
      );
      yield* Effect.promise(() => ctx.db.delete(attachment._id));
    }

    return postId;
  }
);

/** Toggles a reaction on a forum thread. */
export const toggleForumReaction = Effect.fn(
  "school.forums.toggleForumReaction"
)(function* (args: { emoji: string; forumId: Id<"schoolClassForums"> }) {
  const ctx = yield* MutationCtx;
  const emoji = yield* validateForumReactionValue(args.emoji);
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;
  const { forum } = yield* loadActiveForumWithAccess(ctx, args.forumId, userId);
  const existingReaction = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumReactions")
      .withIndex("by_forumId_and_userId_and_emoji", (query) =>
        query
          .eq("forumId", args.forumId)
          .eq("userId", userId)
          .eq("emoji", emoji)
      )
      .unique()
  );

  if (existingReaction) {
    yield* Effect.promise(() => ctx.db.delete(existingReaction._id));
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

  yield* Effect.promise(() =>
    ctx.db.insert("schoolClassForumReactions", {
      emoji,
      forumId: args.forumId,
      userId,
    })
  );

  return { added: true };
});

/** Toggles a reaction on a forum post. */
export const togglePostReaction = Effect.fn("school.forums.togglePostReaction")(
  function* (args: { emoji: string; postId: Id<"schoolClassForumPosts"> }) {
    const ctx = yield* MutationCtx;
    const emoji = yield* validateForumReactionValue(args.emoji);
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const post = yield* Effect.promise(() => ctx.db.get(args.postId));

    if (!post) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Post not found." })
      );
    }

    yield* loadActiveForumWithAccess(ctx, post.forumId, userId);
    const existingReaction = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("by_postId_and_userId_and_emoji", (query) =>
          query
            .eq("postId", args.postId)
            .eq("userId", userId)
            .eq("emoji", emoji)
        )
        .unique()
    );

    if (existingReaction) {
      yield* Effect.promise(() => ctx.db.delete(existingReaction._id));
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

    yield* Effect.promise(() =>
      ctx.db.insert("schoolClassForumPostReactions", {
        emoji,
        postId: args.postId,
        userId,
      })
    );

    return { added: true };
  }
);

/** Marks a forum read through a post boundary. */
export const markForumRead = Effect.fn("school.forums.markForumRead")(
  function* (args: {
    forumId: Id<"schoolClassForums">;
    lastReadPostId: Id<"schoolClassForumPosts">;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const { forum } = yield* loadActiveForumWithAccess(
      ctx,
      args.forumId,
      userId
    );
    const lastReadPost = yield* Effect.promise(() =>
      ctx.db.get(args.lastReadPostId)
    );

    if (!lastReadPost || lastReadPost.forumId !== args.forumId) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Read boundary post not found." })
      );
    }

    yield* updateForumReadState(ctx, {
      classId: forum.classId,
      forumId: args.forumId,
      lastReadSequence: lastReadPost.sequence,
      userId,
    });

    return null;
  }
);
