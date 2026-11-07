import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { libraryField } from "@repo/backend/confect/classroom/library/item";
import { classFolder } from "@repo/backend/confect/classroom/library/place";
import {
  STAR_LIMIT,
  starsOf,
} from "@repo/backend/confect/classroom/library/star";
import spec from "@repo/backend/confect/classroom/library.spec";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Option } from "effect";

/** The item a call names, when it belongs to the allowed class; any other is refused as a missing object. */
export const classItem = Effect.fn("classroom.library.item")(function* (
  itemId: GenericId.GenericId<"classroomLibrary">
) {
  const row = yield* Class;
  const item = yield* (yield* DatabaseReader)
    .table("classroomLibrary")
    .get(itemId)
    .pipe(Effect.option);
  if (Option.isNone(item) || item.value.classId !== row._id) {
    return yield* new AccessDenied({
      action: "library.manage",
      reason: "resource",
    });
  }
  return item.value;
});

/**
 * Changes an item's title and its folder, and a link's address with them, sealed anew under the row that names
 * them. A file keeps its bytes and takes no address, so `address` holds a value for a link only.
 */
export const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("classroom.library.edit")(function* ({
    address,
    folderId,
    itemId,
    title,
  }) {
    const row = yield* Class;
    const item = yield* classItem(itemId);
    if (folderId !== null) {
      yield* classFolder(folderId);
    }
    const moved = { folderId: folderId ?? undefined };
    const keys = yield* schoolKeys(row.tenantId);
    const sealedTitle = yield* sealText(
      keys,
      libraryField(item, "sealedTitle"),
      title
    ).pipe(Effect.orDie);
    const writer = (yield* DatabaseWriter).table("classroomLibrary");
    if (item.kind === "file" || address === null) {
      yield* writer.patch(itemId, { ...moved, sealedTitle }).pipe(Effect.orDie);
      return null;
    }
    const sealedAddress = yield* sealText(
      keys,
      libraryField(item, "sealedAddress"),
      address
    ).pipe(Effect.orDie);
    yield* writer
      .patch(itemId, { ...moved, sealedAddress, sealedTitle })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Moves an item into a folder of the class, or to the top of the library. */
export const move = FunctionImpl.make(
  databaseSchema,
  spec,
  "move",
  Effect.fn("classroom.library.move")(function* ({ folderId, itemId }) {
    yield* classItem(itemId);
    if (folderId !== null) {
      yield* classFolder(folderId);
    }
    yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .patch(itemId, { folderId: folderId ?? undefined })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Stars an item or a folder of the class for the reader alone, or takes the star away. A repeat writes nothing. */
export const star = FunctionImpl.make(
  databaseSchema,
  spec,
  "star",
  Effect.fn("classroom.library.star")(function* ({ starred, target }) {
    const row = yield* Class;
    const { person } = yield* Member;
    if (target.kind === "item") {
      yield* classItem(target.itemId);
    } else {
      yield* classFolder(target.folderId);
    }
    const stars = yield* starsOf(row._id, person._id);
    const existing = Arr.findFirst(stars, (found) =>
      found.kind === "item" && target.kind === "item"
        ? found.itemId === target.itemId
        : found.kind === "folder" &&
          target.kind === "folder" &&
          found.folderId === target.folderId
    );
    const writer = (yield* DatabaseWriter).table("classroomStars");
    if (!starred) {
      yield* Option.match(existing, {
        onNone: () => Effect.void,
        onSome: (found) => writer.delete(found._id).pipe(Effect.orDie),
      });
      return null;
    }
    if (Option.isNone(existing) && stars.length < STAR_LIMIT) {
      yield* writer
        .insert({ ...target, classId: row._id, personId: person._id })
        .pipe(Effect.orDie);
    }
    return null;
  })
);
