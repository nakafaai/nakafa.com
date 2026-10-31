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
import spec from "@repo/backend/confect/classroom/library.spec";
import { sealText } from "@repo/backend/confect/vault/text";
import { Effect, Option } from "effect";

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
 * Changes an item's title, and a link's address with it, sealed anew under the row that names
 * them. A file keeps its bytes and takes no address, so `address` holds a value for a link only.
 */
export const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("classroom.library.edit")(function* ({ address, itemId, title }) {
    const row = yield* Class;
    const item = yield* classItem(itemId);
    const keys = yield* schoolKeys(row.tenantId);
    const sealedTitle = yield* sealText(
      keys,
      libraryField(item, "sealedTitle"),
      title
    ).pipe(Effect.orDie);
    const writer = (yield* DatabaseWriter).table("classroomLibrary");
    if (item.kind === "file" || address === null) {
      yield* writer.patch(itemId, { sealedTitle }).pipe(Effect.orDie);
      return null;
    }
    const sealedAddress = yield* sealText(
      keys,
      libraryField(item, "sealedAddress"),
      address
    ).pipe(Effect.orDie);
    yield* writer
      .patch(itemId, { sealedAddress, sealedTitle })
      .pipe(Effect.orDie);
    return null;
  })
);
