import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { Effect, Option } from "effect";

/** The folder a call names, when it belongs to the allowed class; any other is refused as a missing object. */
export const classFolder = Effect.fn("classroom.library.classFolder")(
  function* (folderId: GenericId.GenericId<"classroomFolders">) {
    const row = yield* Class;
    const folder = yield* (yield* DatabaseReader)
      .table("classroomFolders")
      .get(folderId)
      .pipe(Effect.option);
    if (Option.isNone(folder) || folder.value.classId !== row._id) {
      return yield* new AccessDenied({
        action: "library.manage",
        reason: "resource",
      });
    }
    return folder.value;
  }
);

/**
 * The folder field of a new item of a class. A file takes a while to upload, so a folder that left the class
 * meanwhile, or one of another class, puts the item at the top of the library and never loses it.
 */
export const itemPlace = Effect.fn("classroom.library.place")(function* (
  classId: GenericId.GenericId<"classes">,
  folderId: GenericId.GenericId<"classroomFolders"> | null
) {
  if (folderId === null) {
    return {};
  }
  const folder = yield* (yield* DatabaseReader)
    .table("classroomFolders")
    .get(folderId)
    .pipe(Effect.option);
  return Option.exists(folder, (found) => found.classId === classId)
    ? { folderId }
    : {};
});
