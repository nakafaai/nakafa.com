import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { createOptimisticForumPost } from "@/components/school/classes/forum/conversation/input/optimistic";
import { useUser } from "@/lib/context/use-user";

type CreateForumPostArgs = FunctionArgs<
  typeof api.classes.forums.mutations.posts.createForumPost
>;

/** Creates the Convex post mutation with a transcript-shaped optimistic update. */
export function useCreateForumPost() {
  const currentUser = useUser((state) => state.user);
  const forum = useData((state) => state.forum);
  const createForumPost = useMutation(
    api.classes.forums.mutations.posts.createForumPost
  );

  return (args: CreateForumPostArgs) => {
    if (!(forum && currentUser) || args.attachmentUploadIds?.length) {
      return createForumPost(args);
    }

    const now = Date.now();
    const postId = crypto.randomUUID() as Id<"schoolClassForumPosts">;
    const optimisticMutation = createForumPost.withOptimisticUpdate(
      (localStore, optimisticArgs) => {
        const posts = localStore.getQuery(
          api.classes.forums.queries.pages.getForumPosts,
          { forumId: optimisticArgs.forumId }
        );

        if (!posts) {
          return;
        }

        const parentPost = optimisticArgs.parentId
          ? posts.find((post) => post._id === optimisticArgs.parentId)
          : undefined;

        localStore.setQuery(
          api.classes.forums.queries.pages.getForumPosts,
          { forumId: optimisticArgs.forumId },
          [
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
          ]
        );
      }
    );

    return optimisticMutation(args);
  };
}
