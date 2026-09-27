import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

/** Forum metadata returned by the live Convex forum query. */
export type Forum = NonNullable<
  Ref.Returns<typeof refs.public.classes.forums.queries.forums.getForum>
>;

type ServerForumPost = Ref.Returns<
  typeof refs.public.classes.forums.queries.pages.getForumPosts
>[number];

/** Transcript post row, including client-only optimistic rows before Convex confirms them. */
export type ForumPost = ServerForumPost & {
  isOptimistic?: true;
};

/** Returns whether a transcript row is still a client-only optimistic post. */
export function isOptimisticForumPost(post: ForumPost) {
  return post.isOptimistic === true;
}
