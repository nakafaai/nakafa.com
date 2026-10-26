import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";

/** One announcement of a class, as its home shows it. */
export type ClassPost = Ref.Returns<
  typeof classroom.posts.list
>["page"][number];

const { list } = classroom.posts;

/**
 * Writes what `change` makes of each page of the class's announcements that the store holds. A
 * page that `change` leaves as it was is not written.
 */
const changePages = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (page: readonly ClassPost[], first: boolean) => readonly ClassPost[]
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      const page = query.value.value.page;
      const changed = change(page, query.args.paginationOpts.cursor === null);
      if (changed !== page) {
        localStore.setQuery(
          list,
          query.args,
          Option.some({ ...query.value.value, page: changed })
        );
      }
    }
  }
};

/** Shows an announcement the teacher posts first on the class home, before the server holds it. */
export const publishUpdate =
  (post: ClassPost): OptimisticUpdate<typeof classroom.posts.publish> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page, first) =>
      first ? [post, ...page] : page
    );
  };

/** Shows the teacher's new text of an announcement at once, edited at `at`. */
export const editPostUpdate =
  (at: number): OptimisticUpdate<typeof classroom.posts.edit> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page) =>
      Arr.some(page, (post) => post.id === args.postId)
        ? Arr.map(page, (post) =>
            post.id === args.postId
              ? { ...post, editedAt: at, text: args.text }
              : post
          )
        : page
    );
  };

/** Takes a removed announcement off the class home at once. */
export const removePostUpdate: OptimisticUpdate<
  typeof classroom.posts.remove
> = (localStore, args) => {
  changePages(localStore, args.classId, (page) =>
    Arr.some(page, (post) => post.id === args.postId)
      ? Arr.filter(page, (post) => post.id !== args.postId)
      : page
  );
};
