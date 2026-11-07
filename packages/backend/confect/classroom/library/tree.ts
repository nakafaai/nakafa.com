import type { GenericId } from "@confect/core";
import type { ClassroomFoldersDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { FOLDER_LIMIT } from "@repo/backend/confect/classroom/library/folder";
import { Array as Arr, Effect, HashSet, Option } from "effect";

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

/** The folder of a tree that an ID names. */
const folderOf = (folders: readonly ClassroomFoldersDoc[], id: string) =>
  Arr.findFirst(folders, (folder) => folder._id === id);

/**
 * The folders from one folder up to the top of the library, itself first. A tree holds at most `FOLDER_LIMIT`
 * folders, so a walk longer than that has met a cycle and stops.
 */
export const ancestry = (
  folders: readonly ClassroomFoldersDoc[],
  folderId: string
) => {
  const walk = (
    id: string | undefined,
    chain: readonly ClassroomFoldersDoc[]
  ): readonly ClassroomFoldersDoc[] =>
    id === undefined || chain.length >= FOLDER_LIMIT
      ? chain
      : Option.match(folderOf(folders, id), {
          onNone: () => chain,
          onSome: (folder) => walk(folder.parentId, Arr.append(chain, folder)),
        });
  return walk(folderId, []);
};

/** The folders that the trash hides: each one in the trash, and each one inside a folder in the trash. */
export const hiddenFolders = (folders: readonly ClassroomFoldersDoc[]) =>
  HashSet.fromIterable(
    Arr.filterMap(folders, (folder) =>
      Arr.some(
        ancestry(folders, folder._id),
        (above) => above.trashedAt !== undefined
      )
        ? Option.some<string>(folder._id)
        : Option.none()
    )
  );

/** One folder and every folder inside it, at any depth. */
export const subtree = (
  folders: readonly ClassroomFoldersDoc[],
  rootId: string
) =>
  HashSet.fromIterable(
    Arr.filterMap(folders, (folder) =>
      Arr.some(ancestry(folders, folder._id), (above) => above._id === rootId)
        ? Option.some<string>(folder._id)
        : Option.none()
    )
  );
