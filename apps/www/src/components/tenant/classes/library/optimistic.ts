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
 * Writes what `change` makes of each page of the class's library that the store holds, each folder's pages and those
 * of the items in none. A page that `change` answers none for is left as it was.
 */
const changePages = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (
    page: readonly LibraryItem[],
    first: boolean,
    folderId: LibraryItem["folderId"]
  ) => Option.Option<LibraryItem[]>
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      const value = query.value.value;
      const changed = change(
        value.page,
        query.args.paginationOpts.cursor === null,
        query.args.folderId
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

/** Shows a link the teacher adds first in its folder, before the server holds it. */
export const addLinkUpdate =
  (item: LibraryItem): OptimisticUpdate<typeof classroom.library.addLink> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page, first, folderId) =>
      first && folderId === args.folderId
        ? Option.some([item, ...page])
        : Option.none()
    );
  };

/** Shows an item's new title, and a link's new address, at once, and takes an item moved to another folder away. */
export const editItemUpdate: OptimisticUpdate<typeof classroom.library.edit> = (
  localStore,
  args
) => {
  changePages(localStore, args.classId, (page, _first, folderId) =>
    Option.some(
      folderId === args.folderId
        ? Arr.map(page, (item) =>
            item.id === args.itemId
              ? {
                  ...item,
                  address: args.address ?? item.address,
                  folderId: args.folderId,
                  title: args.title,
                }
              : item
          )
        : Arr.filter(page, (item) => item.id !== args.itemId)
    )
  );
};

/** Takes an item out of every folder page that shows it. */
const dropItem = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  itemId: LibraryItem["id"]
) =>
  changePages(localStore, classId, (page) =>
    Arr.some(page, (item) => item.id === itemId)
      ? Option.some(Arr.filter(page, (item) => item.id !== itemId))
      : Option.none()
  );

/** Takes an item moved to the trash out of its folder at once. */
export const trashItemUpdate: OptimisticUpdate<
  typeof classroom.library.trash
> = (localStore, args) => dropItem(localStore, args.classId, args.itemId);

/** Takes an item moved to another folder out of the folder it left at once. */
export const moveItemUpdate: OptimisticUpdate<typeof classroom.library.move> = (
  localStore,
  args
) => {
  changePages(localStore, args.classId, (page, _first, folderId) =>
    folderId !== args.folderId &&
    Arr.some(page, (item) => item.id === args.itemId)
      ? Option.some(Arr.filter(page, (item) => item.id !== args.itemId))
      : Option.none()
  );
};

/** Shows an item's star at once wherever its page is held. */
export const starItemUpdate: OptimisticUpdate<typeof classroom.library.star> = (
  localStore,
  args
) => {
  const target = args.target;
  if (target.kind !== "item") {
    return;
  }
  changePages(localStore, args.classId, (page) =>
    Option.some(
      Arr.map(page, (item) =>
        item.id === target.itemId ? { ...item, starred: args.starred } : item
      )
    )
  );
};

const { trashed } = classroom.library;

/** Takes an item out of every page of the trash the store holds. */
const leaveTrash = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  itemId: LibraryItem["id"]
) => {
  for (const query of localStore.getAllQueries(trashed)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      const value = query.value.value;
      localStore.setQuery(
        trashed,
        query.args,
        Option.some({
          ...value,
          page: Arr.filter(value.page, (item) => item.id !== itemId),
        })
      );
    }
  }
};

/** Takes an item restored from the trash out of it at once; its folder shows it once the server answers. */
export const restoreItemUpdate: OptimisticUpdate<
  typeof classroom.library.restore
> = (localStore, args) => leaveTrash(localStore, args.classId, args.itemId);

/** Takes an item deleted forever out of the trash at once. */
export const purgeItemUpdate: OptimisticUpdate<
  typeof classroom.library.purge
> = (localStore, args) => leaveTrash(localStore, args.classId, args.itemId);
