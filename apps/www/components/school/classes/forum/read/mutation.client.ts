"use client";

import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import refs from "@repo/backend/confect/_generated/refs";
import { Option } from "effect";
import { markTranscriptRead } from "@/components/school/classes/forum/read/state";

/** Replace the unread count across every loaded forum-list page. */
function updateForumLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  forumId: string,
  unreadCount: number
) {
  const queries = localStore.getAllQueries(
    refs.public.classes.forums.queries.forums.getForums
  );
  for (const query of queries) {
    if (Option.isNone(query.value)) {
      continue;
    }
    localStore.setQuery(
      refs.public.classes.forums.queries.forums.getForums,
      query.args,
      Option.some({
        ...query.value.value,
        page: query.value.value.page.map((forum) =>
          forum._id === forumId
            ? {
                ...forum,
                unreadCount,
              }
            : forum
        ),
      })
    );
  }
}

/** Return a read-state mutation that updates the transcript and forum list. */
export function useMarkForumReadMutation() {
  return useMutation(
    refs.public.classes.forums.mutations.readState.markForumRead
  ).withOptimisticUpdate((localStore, { forumId, lastReadPostId }) => {
    const posts = Option.getOrUndefined(
      localStore.getQuery(
        refs.public.classes.forums.queries.pages.getForumPosts,
        {
          forumId,
        }
      )
    );
    if (!posts) {
      return;
    }
    const state = markTranscriptRead(posts, lastReadPostId);
    if (!state) {
      return;
    }
    localStore.setQuery(
      refs.public.classes.forums.queries.pages.getForumPosts,
      {
        forumId,
      },
      Option.some(state.posts)
    );
    updateForumLists(localStore, forumId, state.unreadCount);
  });
}
