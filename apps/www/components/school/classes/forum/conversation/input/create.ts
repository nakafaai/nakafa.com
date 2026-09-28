import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Option } from "effect";

import { useData } from "@/components/school/classes/forum/conversation/context";
import { createOptimisticForumPost } from "@/components/school/classes/forum/conversation/input/optimistic";
import { useViewer } from "@/lib/identity/client";

type CreateForumPostArgs = Ref.Args<
  typeof refs.public.classes.forums.mutations.posts.createForumPost
>;

/** Creates the Convex post mutation with a transcript-shaped optimistic update. */
export function useCreateForumPost() {
  const currentUser = useViewer((state) => state.account);
  const forum = useData((state) => state.forum);
  const createForumPost = useMutation(
    refs.public.classes.forums.mutations.posts.createForumPost
  );

  return (args: CreateForumPostArgs) => {
    if (!(forum && currentUser) || args.attachmentUploadIds?.length) {
      return createForumPost(args);
    }

    const now = Date.now();
    const postId = crypto.randomUUID() as Id<"schoolClassForumPosts">;
    const optimisticMutation = createForumPost.withOptimisticUpdate(
      (localStore, optimisticArgs) => {
        const cached = localStore.getQuery(
          refs.public.classes.forums.queries.pages.getForumPosts,
          { forumId: optimisticArgs.forumId }
        );

        if (Option.isNone(cached)) {
          return;
        }
        const posts = cached.value;

        const parentPost = optimisticArgs.parentId
          ? posts.find((post) => post._id === optimisticArgs.parentId)
          : undefined;

        localStore.setQuery(
          refs.public.classes.forums.queries.pages.getForumPosts,
          { forumId: optimisticArgs.forumId },
          Option.some([
            ...posts,
            createOptimisticForumPost({
              args: optimisticArgs,
              currentUser: {
                _id: currentUser.appUser._id,
                email: currentUser.appUser.email,
                name: currentUser.appUser.name,
                ...(currentUser.appUser.image === undefined
                  ? {}
                  : { image: currentUser.appUser.image }),
              },
              forum,
              now,
              parentPost,
              postId,
              posts,
            }),
          ])
        );
      }
    );

    return optimisticMutation(args);
  };
}
