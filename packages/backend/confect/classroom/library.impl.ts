import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import type { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { edit, move, star } from "@repo/backend/confect/classroom/library/edit";
import { libraryField } from "@repo/backend/confect/classroom/library/item";
import { itemPlace } from "@repo/backend/confect/classroom/library/place";
import {
  list,
  open,
  search,
  starred,
  trashed,
} from "@repo/backend/confect/classroom/library/read";
import {
  purge,
  purgeRest,
  restore,
  sweep,
  trash,
} from "@repo/backend/confect/classroom/library/trash";
import {
  canAdd,
  commit,
  discard,
  importDrive,
  register,
  removeObjects,
  reserve,
  reserveImport,
  upload,
} from "@repo/backend/confect/classroom/library/upload";
import { libraryViews } from "@repo/backend/confect/classroom/library/views";
import spec from "@repo/backend/confect/classroom/library.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** The item of the allowed class that a client key created, if one did. */
const sentWith = Effect.fn("classroom.library.sentWith")(function* (
  classId: GenericId.GenericId<"classes">,
  clientKey: typeof ClientKey.Type
) {
  return yield* (yield* DatabaseReader)
    .table("classroomLibrary")
    .index("by_classId_and_clientKey", (query) =>
      query.eq("classId", classId).eq("clientKey", clientKey)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * Adds a link to the library, its title and its address sealed with the school
 * key. A repeat of a client key of the class answers that item and writes
 * nothing.
 */
const addLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "addLink",
  Effect.fn("classroom.library.addLink")(function* ({
    address,
    clientKey,
    folderId,
    title,
  }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const sent = yield* sentWith(row._id, clientKey);
    if (Option.isSome(sent)) {
      return Arr.getUnsafe(yield* libraryViews([sent.value]), 0);
    }
    const keys = yield* schoolKeys(row.tenantId);
    const fields = { classId: row._id, clientKey };
    const itemId = yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .insert({
        ...fields,
        ...(yield* itemPlace(row._id, folderId)),
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        kind: "link",
        sealedAddress: yield* sealText(
          keys,
          libraryField(fields, "sealedAddress"),
          address
        ).pipe(Effect.orDie),
        sealedTitle: yield* sealText(
          keys,
          libraryField(fields, "sealedTitle"),
          title
        ).pipe(Effect.orDie),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    const item = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .get(itemId)
      .pipe(Effect.orDie);
    return Arr.getUnsafe(yield* libraryViews([item]), 0);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(trashed),
  Layer.provide(starred),
  Layer.provide(search),
  Layer.provide(addLink),
  Layer.provide(reserve),
  Layer.provide(canAdd),
  Layer.provide(register),
  Layer.provide(importDrive),
  Layer.provide(open),
  Layer.provide(edit),
  Layer.provide(move),
  Layer.provide(star),
  Layer.provide(trash),
  Layer.provide(restore),
  Layer.provide(purge),
  Layer.provide(upload),
  Layer.provide(reserveImport),
  Layer.provide(commit),
  Layer.provide(discard),
  Layer.provide(removeObjects),
  Layer.provide(purgeRest),
  Layer.provide(sweep),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
