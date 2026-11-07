import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { FOLDER_LIMIT } from "@repo/backend/confect/classroom/library/folder";
import { Array as Arr, Effect, HashSet, Option, Result } from "effect";

/** Every folder of one class library, the trash included: at most `FOLDER_LIMIT`, so the whole tree is one read. */
export const classFolders = Effect.fn("classroom.library.classFolders")(
  function* (classId: GenericId.GenericId<"classes">) {
    return yield* (yield* DatabaseReader)
      .table("classroomFolders")
      .index("by_classId", (query) => query.eq("classId", classId))
      .take(FOLDER_LIMIT)
      .pipe(Effect.orDie);
  }
);

/**
 * Any folder row of a tree as these walks read it: its ID, the folder it sits in, and its time in the trash. The
 * walks are generic, so a caller gets back the rows it passed.
 */
const folderOf = <
  F extends {
    readonly _id: string;
    readonly parentId?: string | undefined;
    readonly trashedAt?: number | undefined;
  },
>(
  folders: readonly F[],
  id: string
) => Arr.findFirst(folders, (folder) => folder._id === id);

/**
 * The folders from one folder up to the top of the library, itself first. A tree holds at most `FOLDER_LIMIT`
 * folders, so a walk longer than that has met a cycle and stops.
 */
export const ancestry = <
  F extends {
    readonly _id: string;
    readonly parentId?: string | undefined;
    readonly trashedAt?: number | undefined;
  },
>(
  folders: readonly F[],
  folderId: string
) => {
  const walk = (id: string | undefined, chain: readonly F[]): readonly F[] =>
    id === undefined || chain.length >= FOLDER_LIMIT
      ? chain
      : Option.match(folderOf(folders, id), {
          onNone: () => chain,
          onSome: (folder) => walk(folder.parentId, Arr.append(chain, folder)),
        });
  return walk(folderId, []);
};

/** The folders that the trash hides: each one in the trash, and each one inside a folder in the trash. */
export const hiddenFolders = <
  F extends {
    readonly _id: string;
    readonly parentId?: string | undefined;
    readonly trashedAt?: number | undefined;
  },
>(
  folders: readonly F[]
) =>
  HashSet.fromIterable(
    Arr.filterMap(folders, (folder) =>
      Arr.some(
        ancestry(folders, folder._id),
        (above) => above.trashedAt !== undefined
      )
        ? Result.succeed<string>(folder._id)
        : Result.failVoid
    )
  );

/** One folder and every folder inside it, at any depth. */
export const subtree = <
  F extends {
    readonly _id: string;
    readonly parentId?: string | undefined;
    readonly trashedAt?: number | undefined;
  },
>(
  folders: readonly F[],
  rootId: string
) =>
  HashSet.fromIterable(
    Arr.filterMap(folders, (folder) =>
      Arr.some(ancestry(folders, folder._id), (above) => above._id === rootId)
        ? Result.succeed<string>(folder._id)
        : Result.failVoid
    )
  );
