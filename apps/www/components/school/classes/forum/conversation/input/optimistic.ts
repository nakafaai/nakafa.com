import type { Ref } from "@confect/core";
import type classes from "@repo/backend/confect/_generated/refs/classes";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";

type CreateForumPostArgs = Ref.Args<
  typeof classes.forums.mutations.posts.createForumPost
>;

type ForumPostUser = NonNullable<ForumPost["user"]>;

/** Derives the next temporary sequence from the loaded transcript window. */
function getOptimisticForumPostSequence({
  forum,
  posts,
}: {
  forum: Forum;
  posts: readonly ForumPost[];
}) {
  const latestSequence = posts.at(-1)?.sequence ?? 0;

  return Math.max(forum.nextPostSequence, latestSequence + 1);
}

/** Builds the feed-row shape Convex returns so optimistic chat renders normally. */
export function createOptimisticForumPost({
  args,
  currentUser,
  forum,
  now,
  parentPost,
  postId,
  posts,
}: {
  args: CreateForumPostArgs;
  currentUser: ForumPostUser;
  forum: Forum;
  now: number;
  parentPost: ForumPost | undefined;
  postId: Id<"schoolClassForumPosts">;
  posts: readonly ForumPost[];
}) {
  return {
    _creationTime: now,
    _id: postId,
    attachments: [],
    body: args.body,
    classId: forum.classId,
    createdBy: currentUser._id,
    forumId: args.forumId,
    isOptimistic: true,
    isUnread: false,
    mentions: args.mentions ?? [],
    myReactions: [],
    ...(args.parentId === undefined ? {} : { parentId: args.parentId }),
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    ...(parentPost?.body === undefined
      ? {}
      : { replyToBody: parentPost?.body }),
    replyToUser: parentPost?.user ?? null,
    ...(parentPost?.createdBy === undefined
      ? {}
      : { replyToUserId: parentPost?.createdBy }),
    sequence: getOptimisticForumPostSequence({ forum, posts }),
    updatedAt: now,
    user: currentUser,
  } satisfies ForumPost;
}
