import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { createOptimisticForumPost } from "@/components/school/classes/forum/conversation/input/optimistic";
import { useUser } from "@/lib/context/use-user";

/** Creates the Convex post mutation with a transcript-shaped optimistic update. */
export function useCreateForumPost() {
  const currentUser = useUser((state) => state.user);
  const forum = useData((state) => state.forum);

  return useMutation(
    api.classes.forums.mutations.posts.createForumPost
  ).withOptimisticUpdate((localStore, args) => {
    if (!(forum && currentUser) || args.attachmentUploadIds?.length) {
      return;
    }

    const posts = localStore.getQuery(
      api.classes.forums.queries.pages.getForumPosts,
      {
        forumId: args.forumId,
      }
    );

    if (!posts) {
      return;
    }

    const parentPost = args.parentId
      ? posts.find((post) => post._id === args.parentId)
      : undefined;

    localStore.setQuery(
      api.classes.forums.queries.pages.getForumPosts,
      { forumId: args.forumId },
      [
        ...posts,
        createOptimisticForumPost({
          args,
          currentUser: {
            _id: currentUser.appUser._id,
            email: currentUser.appUser.email,
            name: currentUser.appUser.name,
            ...(currentUser.appUser.image === undefined
              ? {}
              : { image: currentUser.appUser.image }),
          },
          forum,
          now: Date.now(),
          parentPost,
          postId: crypto.randomUUID() as Id<"schoolClassForumPosts">,
          posts,
        }),
      ]
    );
  });
}
