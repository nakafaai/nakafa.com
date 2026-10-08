import type { Ref } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  forumDetailValidator,
  forumUserValidator,
} from "@repo/backend/confect/classes/forums/validators";
import { Schema } from "effect";

import {
  type Forum,
  type ForumPost,
  ForumPostSchema,
} from "@/components/school/classes/forum/conversation/data/entities";

type CreateForumPostArgs = Ref.Args<
  typeof refs.public.classes.forums.mutations.posts.createForumPost
>;

const OptimisticForumPostInputSchema = Schema.Struct({
  currentUser: forumUserValidator,
  forum: forumDetailValidator,
  now: Schema.Finite,
  parentPost: Schema.UndefinedOr(ForumPostSchema),
  postId: IdSchema("schoolClassForumPosts"),
  posts: Schema.Array(ForumPostSchema),
});

type OptimisticForumPostInput = typeof OptimisticForumPostInputSchema.Type;

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
export function createOptimisticForumPost(
  args: CreateForumPostArgs,
  {
    currentUser,
    forum,
    now,
    parentPost,
    postId,
    posts,
  }: OptimisticForumPostInput
) {
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
