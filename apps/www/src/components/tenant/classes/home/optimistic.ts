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
 * page that `change` answers none for is left as it was.
 */
const changePages = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (
    page: readonly ClassPost[],
    first: boolean
  ) => Option.Option<ClassPost[]>
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      const value = query.value.value;
      const changed = change(
        value.page,
        query.args.paginationOpts.cursor === null
      );
      if (Option.isSome(changed)) {
        localStore.setQuery(
          list,
          query.args,
          Option.some({ ...value, page: changed.value })
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
      first ? Option.some([post, ...page]) : Option.none()
    );
  };

/** Shows the teacher's new text of an announcement at once, edited at `at`. */
export const editPostUpdate =
  (at: number): OptimisticUpdate<typeof classroom.posts.edit> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page) =>
      Arr.some(page, (post) => post.id === args.postId)
        ? Option.some(
            Arr.map(page, (post) =>
              post.id === args.postId
                ? { ...post, editedAt: at, text: args.text }
                : post
            )
          )
        : Option.none()
    );
  };

/** Takes a removed announcement off the class home at once. */
export const removePostUpdate: OptimisticUpdate<
  typeof classroom.posts.remove
> = (localStore, args) => {
  changePages(localStore, args.classId, (page) =>
    Arr.some(page, (post) => post.id === args.postId)
      ? Option.some(Arr.filter(page, (post) => post.id !== args.postId))
      : Option.none()
  );
};
