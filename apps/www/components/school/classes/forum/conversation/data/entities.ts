import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** Forum metadata returned by the live Convex forum query. */
export type Forum = NonNullable<
  FunctionReturnType<typeof api.classes.forums.queries.forums.getForum>
>;

type ServerForumPost = FunctionReturnType<
  typeof api.classes.forums.queries.pages.getForumPosts
>[number];

/** Transcript post row, including client-only optimistic rows before Convex confirms them. */
export type ForumPost = ServerForumPost & {
  isOptimistic?: true;
};

/** Returns whether a transcript row is still a client-only optimistic post. */
export function isOptimisticForumPost(post: ForumPost) {
  return post.isOptimistic === true;
}
