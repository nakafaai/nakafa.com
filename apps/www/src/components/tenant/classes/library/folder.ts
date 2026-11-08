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
import { schoolCall } from "@/components/tenant/write";
import { changeLoaded } from "@/lib/data/loaded";

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
  changeLoaded(localStore, list, (folders, args) =>
    args.classId === classId ? Option.some(change(folders)) : Option.none()
  );
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

/** Shows a folder in the folder it moves into at once. */
export const moveFolderUpdate: OptimisticUpdate<
  typeof classroom.folders.move
> = (localStore, args) => {
  changeFolders(localStore, args.classId, (folders) =>
    Arr.map(folders, (folder) =>
      folder.id === args.folderId
        ? { ...folder, parentId: args.parentId }
        : folder
    )
  );
};

/** Moves a folder to the trash at once, which hides everything inside it. */
export const trashFolderUpdate =
  (trashedAt: number): OptimisticUpdate<typeof classroom.folders.trash> =>
  (localStore, args) => {
    changeFolders(localStore, args.classId, (folders) =>
      Arr.map(folders, (folder) =>
        folder.id === args.folderId ? { ...folder, trashedAt } : folder
      )
    );
  };

/** Brings a folder back from the trash at once. */
export const restoreFolderUpdate: OptimisticUpdate<
  typeof classroom.folders.restore
> = (localStore, args) => {
  changeFolders(localStore, args.classId, (folders) =>
    Arr.map(folders, (folder) =>
      folder.id === args.folderId ? { ...folder, trashedAt: null } : folder
    )
  );
};

/** Takes a folder deleted forever out of the library at once. */
export const purgeFolderUpdate: OptimisticUpdate<
  typeof classroom.folders.purge
> = (localStore, args) => {
  changeFolders(localStore, args.classId, (folders) =>
    Arr.filter(folders, (folder) => folder.id !== args.folderId)
  );
};

/** Shows a folder's star at once. */
export const starFolderUpdate: OptimisticUpdate<
  typeof classroom.library.star
> = (localStore, args) => {
  const target = args.target;
  if (target.kind !== "folder") {
    return;
  }
  changeFolders(localStore, args.classId, (folders) =>
    Arr.map(folders, (folder) =>
      folder.id === target.folderId
        ? { ...folder, starred: args.starred }
        : folder
    )
  );
};

/** The folders inside a folder, or at the top of the library, outside the trash. */
export const childFolders = (
  folders: readonly LibraryFolder[],
  parentId: LibraryFolder["parentId"]
) =>
  Arr.filter(
    folders,
    (folder) => folder.parentId === parentId && folder.trashedAt === null
  );

/**
 * The folders from the top of the library down to one folder, itself last. A walk longer than the folders
 * themselves has met a cycle, which the server refuses, and stops.
 */
export const folderPath = (
  folders: readonly LibraryFolder[],
  folderId: LibraryFolder["id"] | null
): readonly LibraryFolder[] => {
  const walk = (
    id: LibraryFolder["id"] | null,
    path: readonly LibraryFolder[]
  ): readonly LibraryFolder[] =>
    id === null || path.length >= folders.length
      ? path
      : Option.match(
          Arr.findFirst(folders, (folder) => folder.id === id),
          {
            onNone: () => path,
            onSome: (folder) => walk(folder.parentId, [folder, ...path]),
          }
        );
  return walk(folderId, []);
};

/** Whether a folder sits inside another one at any depth, or is that folder, so a move would make a cycle. */
export const isWithin = (
  folders: readonly LibraryFolder[],
  folderId: LibraryFolder["id"],
  ancestorId: LibraryFolder["id"]
) =>
  Arr.some(folderPath(folders, folderId), (folder) => folder.id === ancestorId);

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
  return yield* schoolCall(() =>
    add(
      addFolderUpdate({
        author,
        clientKey: args.clientKey,
        createdAt,
        id,
        name: args.name,
        parentId: args.parentId,
        starred: false,
        trashedAt: null,
      }),
      args
    )
  );
});
