import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomFoldersDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { FolderLimit } from "@repo/backend/confect/classroom/errors";
import spec from "@repo/backend/confect/classroom/folders.spec";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  FOLDER_LIMIT,
  folderField,
} from "@repo/backend/confect/classroom/library/folder";
import { classFolder } from "@repo/backend/confect/classroom/library/place";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** The views of some folders for a reader of the allowed class: each name opened with the school key. */
const folderViews = Effect.fn("classroom.folders.views")(function* (
  rows: readonly ClassroomFoldersDoc[]
) {
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(row.tenantId);
  const authors = yield* Effect.forEach(
    Arr.dedupe(Arr.map(rows, (folder) => folder.authorId)),
    (authorId) => reader.table("tenantPeople").get(authorId),
    { concurrency: "unbounded" }
  ).pipe(Effect.orDie);
  return yield* Effect.forEach(rows, (folder) =>
    Effect.gen(function* () {
      // Every author was read above, so a folder without its author is a defect.
      const author = yield* Effect.fromOption(
        Arr.findFirst(authors, (found) => found._id === folder.authorId)
      );
      return {
        author: author.name,
        clientKey: folder.clientKey,
        createdAt: folder.createdAt,
        id: folder._id,
        name: yield* openText(keys, folderField(folder), folder.sealedName),
      };
    }).pipe(Effect.orDie)
  );
});

/** The folders of the class, oldest first. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.folders.list")(function* () {
    const row = yield* Class;
    const folders = yield* (yield* DatabaseReader)
      .table("classroomFolders")
      .index("by_classId", (query) => query.eq("classId", row._id))
      .take(FOLDER_LIMIT)
      .pipe(Effect.orDie);
    return yield* folderViews(folders);
  })
);

/**
 * Adds a folder, its name sealed with the school key. A repeat of a client key of the class answers that folder and
 * writes nothing, and a class that holds the most folders it can refuses another.
 */
const add = FunctionImpl.make(
  databaseSchema,
  spec,
  "add",
  Effect.fn("classroom.folders.add")(function* ({ clientKey, name }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const sent = yield* reader
      .table("classroomFolders")
      .index("by_classId_and_clientKey", (query) =>
        query.eq("classId", row._id).eq("clientKey", clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sent)) {
      return Arr.getUnsafe(yield* folderViews([sent.value]), 0);
    }
    const folders = yield* reader
      .table("classroomFolders")
      .index("by_classId", (query) => query.eq("classId", row._id))
      .take(FOLDER_LIMIT)
      .pipe(Effect.orDie);
    if (folders.length >= FOLDER_LIMIT) {
      return yield* new FolderLimit();
    }
    const keys = yield* schoolKeys(row.tenantId);
    const fields = { classId: row._id, clientKey };
    const folderId = yield* (yield* DatabaseWriter)
      .table("classroomFolders")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        sealedName: yield* sealText(keys, folderField(fields), name).pipe(
          Effect.orDie
        ),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    const folder = yield* reader
      .table("classroomFolders")
      .get(folderId)
      .pipe(Effect.orDie);
    return Arr.getUnsafe(yield* folderViews([folder]), 0);
  })
);

/** Renames a folder, its new name sealed under the row that names it. */
const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("classroom.folders.rename")(function* ({ folderId, name }) {
    const row = yield* Class;
    const folder = yield* classFolder(folderId);
    const keys = yield* schoolKeys(row.tenantId);
    const sealedName = yield* sealText(keys, folderField(folder), name).pipe(
      Effect.orDie
    );
    yield* (yield* DatabaseWriter)
      .table("classroomFolders")
      .patch(folderId, { sealedName })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Removes a folder and leaves its items in the library, at its top. */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("classroom.folders.remove")(function* ({ folderId }) {
    const row = yield* Class;
    const folder = yield* classFolder(folderId);
    const writer = yield* DatabaseWriter;
    const items = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .index("by_classId_and_folderId", (query) =>
        query.eq("classId", row._id).eq("folderId", folder._id)
      )
      .collect()
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      items,
      (item) =>
        writer
          .table("classroomLibrary")
          .patch(item._id, { folderId: undefined })
          .pipe(Effect.orDie),
      { discard: true }
    );
    yield* writer
      .table("classroomFolders")
      .delete(folder._id)
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(add),
  Layer.provide(rename),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
