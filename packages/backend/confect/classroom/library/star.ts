import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Array as Arr, Effect, HashSet, Schema } from "effect";

/** The most stars one Person keeps in one class library. */
export const STAR_LIMIT = 200;

/** Who starred what in which class. */
const starFields = { classId: Id("classes"), personId: Id("tenantPeople") };

/** One item or folder that one Person starred in a class library, so it shows in their Starred view. */
export const starValidator = Schema.Union([
  Schema.Struct({
    ...starFields,
    itemId: Id("classroomLibrary"),
    kind: Schema.Literal("item"),
  }),
  Schema.Struct({
    ...starFields,
    folderId: Id("classroomFolders"),
    kind: Schema.Literal("folder"),
  }),
]);

/** The stars of a Person in a class. */
export const starsOf = Effect.fn("classroom.library.starsOf")(function* (
  classId: GenericId.GenericId<"classes">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("classroomStars")
    .index("by_classId_and_personId", (query) =>
      query.eq("classId", classId).eq("personId", personId)
    )
    .take(STAR_LIMIT)
    .pipe(Effect.orDie);
});

/** The items and folders a Person starred in a class, as one set of IDs. */
export const starredBy = Effect.fn("classroom.library.starredBy")(function* (
  classId: GenericId.GenericId<"classes">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return HashSet.fromIterable(
    Arr.map(yield* starsOf(classId, personId), (star): string =>
      star.kind === "item" ? star.itemId : star.folderId
    )
  );
});
