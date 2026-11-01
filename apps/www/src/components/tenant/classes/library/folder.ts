import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  Array as Arr,
  Clock,
  Effect,
  Option,
  type Result,
  Schema,
} from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";

/** One folder of a class library, as the library shows it. */
export type LibraryFolder = Ref.Returns<typeof classroom.folders.list>[number];

/** The arguments of one new folder, as the dialog gives them. */
type FolderArgs = Ref.Args<typeof classroom.folders.add>;

const { list } = classroom.folders;

/** Whether the server keeps the folder: one the teacher just added holds its client key as its ID until then. */
export const isSavedFolder = (folder: LibraryFolder) =>
  folder.id !== folder.clientKey;

/** Writes what `change` makes of the folders of the class that the store holds. */
const changeFolders = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (folders: readonly LibraryFolder[]) => LibraryFolder[]
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      localStore.setQuery(
        list,
        query.args,
        Option.some(change(query.value.value))
      );
    }
  }
};

/** Shows a folder the teacher adds last among the folders, before the server holds it. */
export const addFolderUpdate =
  (folder: LibraryFolder): OptimisticUpdate<typeof classroom.folders.add> =>
  (localStore, args) => {
    changeFolders(localStore, args.classId, (folders) => [...folders, folder]);
  };

/** Shows a folder's new name at once. */
export const renameFolderUpdate: OptimisticUpdate<
  typeof classroom.folders.rename
> = (localStore, args) => {
  changeFolders(localStore, args.classId, (folders) =>
    Arr.map(folders, (folder) =>
      folder.id === args.folderId ? { ...folder, name: args.name } : folder
    )
  );
};

/** Takes a removed folder out of the library at once. */
export const removeFolderUpdate: OptimisticUpdate<
  typeof classroom.folders.remove
> = (localStore, args) => {
  changeFolders(localStore, args.classId, (folders) =>
    Arr.filter(folders, (folder) => folder.id !== args.folderId)
  );
};

/**
 * The folder the teacher adds, shown at once last among the folders under its client key, which is its
 * placeholder ID until the server answers. `add` is Confect's mutation with the optimistic update it is given.
 */
export const addLibraryFolder = Effect.fn("classroom.folders.add")(function* <
  E,
>(
  add: (
    update: ReturnType<typeof addFolderUpdate>,
    args: FolderArgs
  ) => Promise<Result.Result<LibraryFolder, E>>,
  author: string,
  args: FolderArgs
) {
  const createdAt = yield* Clock.currentTimeMillis;
  const id = yield* Schema.decodeUnknownEffect(Id("classroomFolders"))(
    args.clientKey
  );
  return yield* forumCall(() =>
    add(
      addFolderUpdate({
        author,
        clientKey: args.clientKey,
        createdAt,
        id,
        name: args.name,
      }),
      args
    )
  );
});
