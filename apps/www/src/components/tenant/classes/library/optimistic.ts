import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";

/** One item of a class library, as the library shows it. */
export type LibraryItem = Ref.Returns<
  typeof classroom.library.list
>["page"][number];

const { list } = classroom.library;

/**
 * Writes what `change` makes of each page of the class's library that the store holds. A page
 * that `change` answers none for is left as it was.
 */
const changePages = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (
    page: readonly LibraryItem[],
    first: boolean
  ) => Option.Option<LibraryItem[]>
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

/** Shows a link the teacher adds first in the library, before the server holds it. */
export const addLinkUpdate =
  (item: LibraryItem): OptimisticUpdate<typeof classroom.library.addLink> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page, first) =>
      first ? Option.some([item, ...page]) : Option.none()
    );
  };

/** Takes a removed item out of the library at once. */
export const removeItemUpdate: OptimisticUpdate<
  typeof classroom.library.remove
> = (localStore, args) => {
  changePages(localStore, args.classId, (page) =>
    Arr.some(page, (item) => item.id === args.itemId)
      ? Option.some(Arr.filter(page, (item) => item.id !== args.itemId))
      : Option.none()
  );
};
