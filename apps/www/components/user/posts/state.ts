import type { Ref } from "@confect/core";
import type posts from "@repo/backend/confect/_generated/refs/posts";
import { Array as Arr } from "effect";

/** How many posts a page of the profile holds, the first one and each one after it. */
export const POST_PAGE_SIZE = 20;

/** One post as the list of an author's posts shows it. */
export type ListPost = Ref.Returns<typeof posts.queries.list>["page"][number];

/** Puts a post at the top of a page, where the newest posts go. */
export function prependPost(page: readonly ListPost[], post: ListPost) {
  return Arr.prepend(page, post);
}

/** Changes the post with this id on a page, and keeps every other post as it is. */
export function updatePost(
  page: readonly ListPost[],
  postId: ListPost["_id"],
  change: (post: ListPost) => ListPost
) {
  return Arr.map(page, (post) => (post._id === postId ? change(post) : post));
}

/** Takes the post with this id off a page. */
export function removePost(page: readonly ListPost[], postId: ListPost["_id"]) {
  return Arr.filter(page, (post) => post._id !== postId);
}

/** The post as it reads once its viewer has liked it: one more like, and liked. */
export function likePost(post: ListPost): ListPost {
  return { ...post, liked: true, likeCount: post.likeCount + 1 };
}

/** The post as it reads once its viewer has taken the like back. */
export function unlikePost(post: ListPost): ListPost {
  return { ...post, liked: false, likeCount: post.likeCount - 1 };
}
