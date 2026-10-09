"use client";

import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import classes from "@repo/backend/confect/_generated/refs/classes";
import { Option } from "effect";
import { toggleReactionState } from "@/components/school/classes/forum/reaction/state";
import { useViewer } from "@/lib/identity/client";

/** Toggle a forum reaction across every loaded forum list page. */
function updateForumLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  forumId: string,
  emoji: string,
  reactorName?: string
) {
  const queries = localStore.getAllQueries(
    classes.forums.queries.forums.getForums
  );
  for (const query of queries) {
    if (Option.isNone(query.value)) {
      continue;
    }
    localStore.setQuery(
      classes.forums.queries.forums.getForums,
      query.args,
      Option.some({
        ...query.value.value,
        page: query.value.value.page.map((forum) =>
          forum._id === forumId
            ? toggleReactionState(forum, emoji, reactorName)
            : forum
        ),
      })
    );
  }
}

/** Return a forum reaction mutation that updates loaded list and detail caches. */
export function useForumReactionMutation() {
  const reactorName = useViewer((state) => state.viewer?.name);
  return useMutation(
    classes.forums.mutations.reactions.toggleForumReaction
  ).withOptimisticUpdate((localStore, { emoji, forumId }) => {
    const forum = Option.getOrUndefined(
      localStore.getQuery(classes.forums.queries.forums.getForum, {
        forumId,
      })
    );
    if (forum) {
      localStore.setQuery(
        classes.forums.queries.forums.getForum,
        {
          forumId,
        },
        Option.some(toggleReactionState(forum, emoji, reactorName))
      );
    }
    updateForumLists(localStore, forumId, emoji, reactorName);
  });
}

/** Return a post reaction mutation that updates every loaded transcript cache. */
export function usePostReactionMutation() {
  const reactorName = useViewer((state) => state.viewer?.name);
  return useMutation(
    classes.forums.mutations.reactions.togglePostReaction
  ).withOptimisticUpdate((localStore, { emoji, postId }) => {
    const queries = localStore.getAllQueries(
      classes.forums.queries.pages.getForumPosts
    );
    for (const query of queries) {
      if (Option.isNone(query.value)) {
        continue;
      }
      localStore.setQuery(
        classes.forums.queries.pages.getForumPosts,
        query.args,
        Option.some(
          query.value.value.map((post) =>
            post._id === postId
              ? toggleReactionState(post, emoji, reactorName)
              : post
          )
        )
      );
    }
  });
}
