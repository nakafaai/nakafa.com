"use client";

import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import {
  deleteCommentFromPage,
  updateCommentVote,
} from "@/components/comments/state";

type SlugComment = Ref.Returns<
  typeof comments.queries.getCommentsBySlug
>["page"][number];

/** Apply a comment transform across every loaded content-route feed. */
function updateSlugFeeds(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  commentId: Id<"comments">,
  update: (comment: SlugComment) => SlugComment
) {
  for (const query of localStore.getAllQueries(
    comments.queries.getCommentsBySlug
  )) {
    if (Option.isNone(query.value)) {
      continue;
    }
    localStore.setQuery(
      comments.queries.getCommentsBySlug,
      query.args,
      Option.some({
        ...query.value.value,
        page: Arr.map(query.value.value.page, (comment) =>
          comment._id === commentId ? update(comment) : comment
        ),
      })
    );
  }
}

/** Return a vote mutation that updates loaded slug and profile feeds. */
export function useVoteCommentMutation() {
  return useMutation(comments.mutations.voteOnComment).withOptimisticUpdate(
    (localStore, { commentId, vote }) => {
      updateSlugFeeds(localStore, commentId, (comment) =>
        updateCommentVote(comment, vote)
      );
      for (const query of localStore.getAllQueries(
        comments.queries.getCommentsByUserId
      )) {
        if (Option.isNone(query.value)) {
          continue;
        }
        localStore.setQuery(
          comments.queries.getCommentsByUserId,
          query.args,
          Option.some({
            ...query.value.value,
            page: Arr.map(query.value.value.page, (comment) =>
              comment._id === commentId
                ? updateCommentVote(comment, vote)
                : comment
            ),
          })
        );
      }
    }
  );
}

/** Remove one comment from every loaded content and profile feed. */
function deleteFromLoadedFeeds(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  commentId: Id<"comments">
) {
  for (const query of localStore.getAllQueries(
    comments.queries.getCommentsBySlug
  )) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        comments.queries.getCommentsBySlug,
        query.args,
        Option.some({
          ...query.value.value,
          page: deleteCommentFromPage(query.value.value.page, commentId),
        })
      );
    }
  }
  for (const query of localStore.getAllQueries(
    comments.queries.getCommentsByUserId
  )) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        comments.queries.getCommentsByUserId,
        query.args,
        Option.some({
          ...query.value.value,
          page: deleteCommentFromPage(query.value.value.page, commentId),
        })
      );
    }
  }
}

/** Return a delete mutation that removes the comment from every loaded feed. */
export function useDeleteCommentMutation() {
  return useMutation(comments.mutations.deleteComment).withOptimisticUpdate(
    (localStore, { commentId }) => {
      deleteFromLoadedFeeds(localStore, commentId);
    }
  );
}
