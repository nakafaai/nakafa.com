import type { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FunctionArgs } from "convex/server";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";

type CreateForumPostArgs = FunctionArgs<
  typeof api.classes.forums.mutations.posts.createForumPost
>;

type ForumPostUser = NonNullable<ForumPost["user"]>;

interface OptimisticForumPostInput {
  args: CreateForumPostArgs;
  currentUser: ForumPostUser;
  forum: Forum;
  now: number;
  parentPost: ForumPost | undefined;
  postId: Id<"schoolClassForumPosts">;
  posts: readonly ForumPost[];
}

/** Derives the next temporary sequence from the loaded transcript window. */
export function getOptimisticForumPostSequence({
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
}: OptimisticForumPostInput) {
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
    parentId: args.parentId,
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: parentPost?.body,
    replyToUser: parentPost?.user ?? null,
    replyToUserId: parentPost?.createdBy,
    sequence: getOptimisticForumPostSequence({ forum, posts }),
    updatedAt: now,
    user: currentUser,
  } satisfies ForumPost;
}
