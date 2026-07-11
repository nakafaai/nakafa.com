"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { toggleReactionState } from "@/components/school/classes/forum/reaction/state";
import { useUser } from "@/lib/context/use-user";

function updateForumLists(
  localStore: OptimisticLocalStore,
  forumId: string,
  emoji: string,
  reactorName?: string
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
          forum._id === forumId
            ? toggleReactionState(forum, emoji, reactorName)
            : forum
        ),
      }
    );
  }
}

/** Return a forum reaction mutation that updates loaded list and detail caches. */
export function useForumReactionMutation() {
  const reactorName = useUser(
    ({ user }) => user?.appUser.name ?? user?.authUser.name
  );

  return useMutation(
    api.classes.forums.mutations.reactions.toggleForumReaction
  ).withOptimisticUpdate((localStore, { emoji, forumId }) => {
    const forum = localStore.getQuery(
      api.classes.forums.queries.forums.getForum,
      { forumId }
    );

    if (forum) {
      localStore.setQuery(
        api.classes.forums.queries.forums.getForum,
        { forumId },
        toggleReactionState(forum, emoji, reactorName)
      );
    }

    updateForumLists(localStore, forumId, emoji, reactorName);
  });
}

/** Return a post reaction mutation that updates every loaded transcript cache. */
export function usePostReactionMutation() {
  const reactorName = useUser(
    ({ user }) => user?.appUser.name ?? user?.authUser.name
  );

  return useMutation(
    api.classes.forums.mutations.reactions.togglePostReaction
  ).withOptimisticUpdate((localStore, { emoji, postId }) => {
    const queries = localStore.getAllQueries(
      api.classes.forums.queries.pages.getForumPosts
    );

    for (const query of queries) {
      if (!query.value) {
        continue;
      }

      localStore.setQuery(
        api.classes.forums.queries.pages.getForumPosts,
        query.args,
        query.value.map((post) =>
          post._id === postId
            ? toggleReactionState(post, emoji, reactorName)
            : post
        )
      );
    }
  });
}
