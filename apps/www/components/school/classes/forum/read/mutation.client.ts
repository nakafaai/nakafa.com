"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { markTranscriptRead } from "@/components/school/classes/forum/read/state";

function updateForumLists(
  localStore: OptimisticLocalStore,
  forumId: string,
  unreadCount: number
) {
  const queries = localStore.getAllQueries(
    api.classes.forums.queries.forums.getForums
  );

  for (const query of queries) {
    if (!query.value) {
      continue;
    }

    localStore.setQuery(
      api.classes.forums.queries.forums.getForums,
      query.args,
      {
        ...query.value,
        page: query.value.page.map((forum) =>
          forum._id === forumId ? { ...forum, unreadCount } : forum
        ),
      }
    );
  }
}

/** Return a read-state mutation that updates the transcript and forum list. */
export function useMarkForumReadMutation() {
  return useMutation(
    api.classes.forums.mutations.readState.markForumRead
  ).withOptimisticUpdate((localStore, { forumId, lastReadPostId }) => {
    const posts = localStore.getQuery(
      api.classes.forums.queries.pages.getForumPosts,
      { forumId }
    );

    if (!posts) {
      return;
    }

    const state = markTranscriptRead(posts, lastReadPostId);

    if (!state) {
      return;
    }

    localStore.setQuery(
      api.classes.forums.queries.pages.getForumPosts,
      { forumId },
      state.posts
    );
    updateForumLists(localStore, forumId, state.unreadCount);
  });
}
