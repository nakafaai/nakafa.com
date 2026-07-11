"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  deleteCommentFromPage,
  updateCommentVote,
} from "@/components/comments/state";

type SlugComment = FunctionReturnType<
  typeof api.comments.queries.getCommentsBySlug
>["page"][number];

function updateSlugFeeds(
  localStore: OptimisticLocalStore,
  commentId: Id<"comments">,
  update: (comment: SlugComment) => SlugComment
) {
  for (const query of localStore.getAllQueries(
    api.comments.queries.getCommentsBySlug
  )) {
    if (!query.value) {
      continue;
    }

    localStore.setQuery(api.comments.queries.getCommentsBySlug, query.args, {
      ...query.value,
      page: query.value.page.map((comment) =>
        comment._id === commentId ? update(comment) : comment
      ),
    });
  }
}

/** Return a vote mutation that updates loaded slug and profile feeds. */
export function useVoteCommentMutation() {
  return useMutation(api.comments.mutations.voteOnComment).withOptimisticUpdate(
    (localStore, { commentId, vote }) => {
      updateSlugFeeds(localStore, commentId, (comment) =>
        updateCommentVote(comment, vote)
      );

      for (const query of localStore.getAllQueries(
        api.comments.queries.getCommentsByUserId
      )) {
        if (!query.value) {
          continue;
        }

        localStore.setQuery(
          api.comments.queries.getCommentsByUserId,
          query.args,
          {
            ...query.value,
            page: query.value.page.map((comment) =>
              comment._id === commentId
                ? updateCommentVote(comment, vote)
                : comment
            ),
          }
        );
      }
    }
  );
}

function deleteFromLoadedFeeds(
  localStore: OptimisticLocalStore,
  commentId: Id<"comments">
) {
  for (const query of localStore.getAllQueries(
    api.comments.queries.getCommentsBySlug
  )) {
    if (query.value) {
      localStore.setQuery(api.comments.queries.getCommentsBySlug, query.args, {
        ...query.value,
        page: deleteCommentFromPage(query.value.page, commentId),
      });
    }
  }

  for (const query of localStore.getAllQueries(
    api.comments.queries.getCommentsByUserId
  )) {
    if (query.value) {
      localStore.setQuery(
        api.comments.queries.getCommentsByUserId,
        query.args,
        {
          ...query.value,
          page: deleteCommentFromPage(query.value.page, commentId),
        }
      );
    }
  }
}

/** Return a delete mutation that removes the comment from every loaded feed. */
export function useDeleteCommentMutation() {
  return useMutation(api.comments.mutations.deleteComment).withOptimisticUpdate(
    (localStore, { commentId }) => {
      deleteFromLoadedFeeds(localStore, commentId);
    }
  );
}
