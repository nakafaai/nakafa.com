import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { QueryCtx as ConvexQueryCtx } from "@repo/backend/confect/_generated/services";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { getUserMap } from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type {
  SchoolClassForumPosts,
  SchoolClassForums,
} from "@repo/backend/confect/modules/school/classes.tables";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/confect/modules/school/forums/aggregates";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/modules/school/forums/constants";
import {
  getMyPostReactions,
  getPostReactionPreviews,
} from "@repo/backend/confect/modules/school/forums/reactions.service";
import { Effect, Option, type Schema } from "effect";

type DatabaseCtx = ConvexQueryCtx;
type ForumDoc = Schema.Schema.Type<typeof SchoolClassForums.Doc>;
type ForumPostDoc = Schema.Schema.Type<typeof SchoolClassForumPosts.Doc>;

/** Truncates forum reply preview text. */
export function truncateText({
  maxLength = 200,
  text,
}: {
  readonly maxLength?: number;
  readonly text: string;
}) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}\u2026`;
}

/** Reads the current read state for a forum and user. */
export const getForumReadState = Effect.fn("school.forums.getForumReadState")(
  function* (forumId: Id<"schoolClassForums">, currentUserId: Id<"users">) {
    const reader = yield* DatabaseReader;

    return yield* reader
      .table("schoolClassForumReadStates")
      .index("by_forumId_and_userId", (query) =>
        query.eq("forumId", forumId).eq("userId", currentUserId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));
  }
);

/** Writes a read state only when the boundary moves forward. */
export const updateForumReadState = Effect.fn(
  "school.forums.updateForumReadState"
)(function* (args: {
  readonly classId: Id<"schoolClasses">;
  readonly forumId: Id<"schoolClassForums">;
  readonly lastReadSequence: number;
  readonly userId: Id<"users">;
}) {
  const writer = yield* DatabaseWriter;
  const existing = yield* getForumReadState(args.forumId, args.userId);

  if (!existing) {
    yield* writer.table("schoolClassForumReadStates").insert({
      classId: args.classId,
      forumId: args.forumId,
      lastReadSequence: args.lastReadSequence,
      userId: args.userId,
    });

    return null;
  }

  if (args.lastReadSequence <= existing.lastReadSequence) {
    return null;
  }

  yield* writer.table("schoolClassForumReadStates").patch(existing._id, {
    lastReadSequence: args.lastReadSequence,
  });

  return null;
});

/** Reads unread counts for forums without counting the user's own posts. */
export const getForumUnreadCounts = Effect.fn(
  "school.forums.getForumUnreadCounts"
)(function* (
  ctx: DatabaseCtx,
  args: {
    readonly forums: readonly ForumDoc[];
    readonly userId: Id<"users">;
  }
) {
  if (args.forums.length === 0) {
    return new Map();
  }

  const readStateByForumId = new Map();

  for (const forum of args.forums) {
    const readState = yield* getForumReadState(forum._id, args.userId);
    readStateByForumId.set(forum._id, readState);
  }

  const forumsWithUnreadPotential = args.forums.filter((forum) => {
    if (forum.postCount === 0) {
      return false;
    }

    const lastReadSequence =
      readStateByForumId.get(forum._id)?.lastReadSequence ?? 0;

    return lastReadSequence < forum.nextPostSequence - 1;
  });
  const unreadCountByForumId = new Map<Id<"schoolClassForums">, number>(
    args.forums.map((forum) => [forum._id, 0] as const)
  );

  if (forumsWithUnreadPotential.length === 0) {
    return unreadCountByForumId;
  }

  const totalUnreadCounts = yield* Effect.promise(() =>
    forumPostsBySequence.countBatch(
      ctx,
      forumsWithUnreadPotential.map((forum) => ({
        bounds: {
          lower: {
            inclusive: false,
            key: readStateByForumId.get(forum._id)?.lastReadSequence ?? 0,
          },
        },
        namespace: forum._id,
      }))
    )
  );
  const ownUnreadCounts = yield* Effect.promise(() =>
    forumPostsByAuthorSequence.countBatch(
      ctx,
      forumsWithUnreadPotential.map((forum) => ({
        bounds: {
          lower: {
            inclusive: false,
            key: readStateByForumId.get(forum._id)?.lastReadSequence ?? 0,
          },
        },
        namespace: [forum._id, args.userId],
      }))
    )
  );

  for (const [index, forum] of forumsWithUnreadPotential.entries()) {
    const totalUnreadCount = totalUnreadCounts[index];
    const ownUnreadCount = ownUnreadCounts[index];

    if (totalUnreadCount === undefined || ownUnreadCount === undefined) {
      continue;
    }

    unreadCountByForumId.set(
      forum._id,
      Math.max(totalUnreadCount - ownUnreadCount, 0)
    );
  }

  return unreadCountByForumId;
});

/** Adds users, attachments, and reaction previews to forum posts. */
export const enrichForumPosts = Effect.fn("school.forums.enrichForumPosts")(
  function* (posts: readonly ForumPostDoc[], currentUserId: Id<"users">) {
    if (posts.length === 0) {
      return [];
    }

    const reader = yield* DatabaseReader;
    const storage = yield* StorageReader;
    const postIds = posts.map((post) => post._id);
    const postUserIds = posts.flatMap((post) =>
      post.replyToUserId
        ? [post.createdBy, post.replyToUserId]
        : [post.createdBy]
    );
    const reactionPreviews = yield* getPostReactionPreviews(posts);
    const myReactionsMap = yield* getMyPostReactions(postIds, currentUserId);
    const allAttachments = yield* Effect.forEach(postIds, (postId) =>
      Effect.gen(function* () {
        const attachments = yield* reader
          .table("schoolClassForumPostAttachments")
          .index("by_postId", (query) => query.eq("postId", postId))
          .take(MAX_FORUM_POST_ATTACHMENTS + 1);

        if (attachments.length > MAX_FORUM_POST_ATTACHMENTS) {
          return yield* Effect.fail(
            new ClassActionError({
              message:
                "Forum post attachment count exceeds the supported limit.",
            })
          );
        }

        return [postId, attachments] as const;
      })
    );

    const flatAttachments = allAttachments.flatMap(
      ([, attachments]) => attachments
    );
    const userMap = yield* getUserMap(postUserIds);
    const urlEntries = yield* Effect.forEach(flatAttachments, (attachment) =>
      Effect.gen(function* () {
        const url = yield* storage
          .getUrl(attachment.fileId)
          .pipe(
            Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null))
          );
        return [attachment._id, url] as const;
      })
    );

    const urlMap = new Map(urlEntries);
    const attachmentsByPost = new Map(
      allAttachments.map(([postId, attachments]) => [
        postId,
        attachments.map((attachment) => ({
          _id: attachment._id,
          mimeType: attachment.mimeType,
          name: attachment.name,
          size: attachment.size,
          url: urlMap.get(attachment._id)?.toString() ?? null,
        })),
      ])
    );

    return posts.map((post) => ({
      ...post,
      attachments: attachmentsByPost.get(post._id) ?? [],
      myReactions: myReactionsMap.get(post._id) ?? [],
      reactionUsers: post.reactionCounts.map(({ count, emoji }) => ({
        count,
        emoji,
        reactors: reactionPreviews.get(post._id)?.get(emoji) ?? [],
      })),
      replyToUser: post.replyToUserId
        ? (userMap.get(post.replyToUserId) ?? null)
        : null,
      user: userMap.get(post.createdBy) ?? null,
    }));
  }
);

/** Builds the bounded forum post transcript for a user. */
export const createForumFeedPosts = Effect.fn(
  "school.forums.createForumFeedPosts"
)(function* (args: {
  readonly currentUserId: Id<"users">;
  readonly forumId: Id<"schoolClassForums">;
  readonly posts: readonly ForumPostDoc[];
}) {
  const enrichedPosts = yield* enrichForumPosts(args.posts, args.currentUserId);
  const readState = yield* getForumReadState(args.forumId, args.currentUserId);
  const lastReadSequence = readState?.lastReadSequence ?? 0;

  return enrichedPosts.map((post) => ({
    ...post,
    isUnread:
      post.createdBy !== args.currentUserId && post.sequence > lastReadSequence,
  }));
});
