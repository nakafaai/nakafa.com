"use client";

import type { OptimisticUpdate } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Option } from "effect";
import {
  type ListPost,
  likePost,
  prependPost,
  removePost,
  unlikePost,
  updatePost,
} from "@/components/user/posts/state";

/** Changes the page of every loaded list of posts, so each open list shows the change. */
export function changeLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  change: (page: readonly ListPost[]) => ListPost[]
) {
  for (const query of localStore.getAllQueries(posts.queries.list)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        posts.queries.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/**
 * The change that shows a new post at the top of the first page of each list
 * while the server saves it. The saved post replaces it in the list once the
 * server answers, and a refused post leaves the list as it was.
 */
export function insertDraftPost(
  draft: ListPost
): OptimisticUpdate<typeof posts.mutations.create> {
  return (localStore) => {
    for (const query of localStore.getAllQueries(posts.queries.list)) {
      if (
        Option.isSome(query.value) &&
        query.args.paginationOpts.cursor === null
      ) {
        localStore.setQuery(
          posts.queries.list,
          query.args,
          Option.some({
            ...query.value.value,
            page: prependPost(query.value.value.page, draft),
          })
        );
      }
    }
  };
}

/** The change that shows a like on the post at once, in every loaded list. */
export const likeInLists: OptimisticUpdate<typeof posts.mutations.like> = (
  localStore,
  { postId }
) => changeLists(localStore, (page) => updatePost(page, postId, likePost));

/** The change that takes a like off the post at once, in every loaded list. */
export const unlikeInLists: OptimisticUpdate<typeof posts.mutations.unlike> = (
  localStore,
  { postId }
) => changeLists(localStore, (page) => updatePost(page, postId, unlikePost));

/** The change that takes the post off every loaded list at once. */
export const removeFromLists: OptimisticUpdate<
  typeof posts.mutations.remove
> = (localStore, { postId }) =>
  changeLists(localStore, (page) => removePost(page, postId));
