import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadOpenForumWithAccess } from "@repo/backend/confect/classes/forums/access";
import { resolveForumAttachmentUploads } from "@repo/backend/confect/classes/forums/attachments/impl";
import { ForumAttachmentError } from "@repo/backend/confect/classes/forums/attachments/spec";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/classes/forums/constants";
import { validateForumMentions } from "@repo/backend/confect/classes/forums/mentions";
import spec from "@repo/backend/confect/classes/forums/mutations/posts.spec";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { truncateText } from "@repo/backend/confect/utils/text";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Clock, Effect, Layer, Struct } from "effect";

/**
 * Create a new forum post.
 */
const createForumPost = FunctionImpl.make(
  databaseSchema,
  spec,
  "createForumPost",
  Effect.fn("classes.forums.mutations.posts.createForumPost")(function* (args) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const ctx = yield* MutationCtxService;
    const user = yield* requireAuth(ctx);
    const userId = user.appUser._id;
    const attachmentUploadIds = args.attachmentUploadIds ?? [];
    if (attachmentUploadIds.length > MAX_FORUM_POST_ATTACHMENTS) {
      return yield* new ForumAttachmentError({
        code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
        message: "Forum post attachment count exceeds the supported limit.",
      });
    }
    if (!(args.body.trim().length > 0 || attachmentUploadIds.length > 0)) {
      return yield* new ForumError({
        code: "EMPTY_POST",
        message: "Post must have either a message or attachments.",
      });
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
    const parentId = args.parentId;
    if (parentId) {
      const parentPost = yield* database
        .table("schoolClassForumPosts")
        .get(parentId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!parentPost || parentPost.forumId !== args.forumId) {
        return yield* new ForumError({
          code: "PARENT_POST_NOT_FOUND",
          message: "Parent post not found.",
        });
      }
      replyToBody = truncateText({
        text: parentPost.body,
      });
      replyToUserId = parentPost.createdBy;
    }
    const now = yield* Clock.currentTimeMillis;
    const sequence = forum.nextPostSequence;
    yield* writer
      .table("schoolClassForums")
      .patch(forum._id, {
        nextPostSequence: sequence + 1,
      })
      .pipe(Effect.orDie);
    const postId = yield* writer
      .table("schoolClassForumPosts")
      .insert({
        body: args.body,
        classId: forum.classId,
        createdBy: userId,
        forumId: args.forumId,
        mentions,
        ...Struct.pick(args, ["parentId"]),
        reactionCounts: [],
        replyCount: 0,
        ...(replyToBody === undefined
          ? {}
          : {
              replyToBody,
            }),
        ...(replyToUserId === undefined
          ? {}
          : {
              replyToUserId,
            }),
        sequence,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    for (const attachment of attachments) {
      yield* writer
        .table("schoolClassForumPostAttachments")
        .insert({
          classId: forum.classId,
          createdBy: userId,
          fileId: attachment.storageId,
          forumId: args.forumId,
          mimeType: attachment.mimeType,
          name: attachment.name,
          postId,
          size: attachment.size,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("schoolClassForumPendingUploads")
        .delete(attachment._id);
    }
    return postId;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(createForumPost),
  Layer.provide(atomic),
  GroupImpl.finalize
);
