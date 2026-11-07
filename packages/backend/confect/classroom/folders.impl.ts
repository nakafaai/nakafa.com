import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomFoldersDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import {
  FolderCycle,
  FolderLimit,
} from "@repo/backend/confect/classroom/errors";
import spec from "@repo/backend/confect/classroom/folders.spec";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  FOLDER_LIMIT,
  folderField,
} from "@repo/backend/confect/classroom/library/folder";
import { classFolder } from "@repo/backend/confect/classroom/library/place";
import { starredBy } from "@repo/backend/confect/classroom/library/star";
import { purgeTree } from "@repo/backend/confect/classroom/library/trash";
import {
  ancestry,
  classFolders,
} from "@repo/backend/confect/classroom/library/tree";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, HashSet, Layer, Option } from "effect";

/** The views of some folders for a reader of the allowed class: each name opened with the school key, and the reader's stars. */
const folderViews = Effect.fn("classroom.folders.views")(function* (
  rows: readonly ClassroomFoldersDoc[]
) {
  const row = yield* Class;
  const { person } = yield* Member;
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(row.tenantId);
  const stars = yield* starredBy(row._id, person._id);
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
        parentId: folder.parentId ?? null,
        starred: HashSet.has(stars, folder._id),
        trashedAt: folder.trashedAt ?? null,
      };
    }).pipe(Effect.orDie)
  );
});

/** Every folder of the class, at any depth and in the trash, oldest first. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.folders.list")(function* () {
    const row = yield* Class;
    return yield* folderViews(yield* classFolders(row._id));
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
  Effect.fn("classroom.folders.add")(function* ({ clientKey, name, parentId }) {
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
    const folders = yield* classFolders(row._id);
    if (folders.length >= FOLDER_LIMIT) {
      return yield* new FolderLimit();
    }
    if (parentId !== null) {
      yield* classFolder(parentId);
    }
    const keys = yield* schoolKeys(row.tenantId);
    const fields = { classId: row._id, clientKey };
    const folderId = yield* (yield* DatabaseWriter)
      .table("classroomFolders")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        ...(parentId === null ? {} : { parentId }),
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

/** Moves a folder into another folder of the class, or to the top. A folder never moves into itself or below itself. */
const move = FunctionImpl.make(
  databaseSchema,
  spec,
  "move",
  Effect.fn("classroom.folders.move")(function* ({ folderId, parentId }) {
    const row = yield* Class;
    yield* classFolder(folderId);
    if (parentId !== null) {
      yield* classFolder(parentId);
      const above = ancestry(yield* classFolders(row._id), parentId);
      if (Arr.some(above, (folder) => folder._id === folderId)) {
        return yield* new FolderCycle();
      }
    }
    yield* (yield* DatabaseWriter)
      .table("classroomFolders")
      .patch(folderId, { parentId: parentId ?? undefined })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Moves a folder to the trash, which hides it and everything inside it. */
const trash = FunctionImpl.make(
  databaseSchema,
  spec,
  "trash",
  Effect.fn("classroom.folders.trash")(function* ({ folderId }) {
    yield* classFolder(folderId);
    yield* (yield* DatabaseWriter)
      .table("classroomFolders")
      .patch(folderId, { trashedAt: yield* Clock.currentTimeMillis })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Brings a folder back from the trash with everything inside it, to the top when the folder it sat in is gone. */
const restore = FunctionImpl.make(
  databaseSchema,
  spec,
  "restore",
  Effect.fn("classroom.folders.restore")(function* ({ folderId }) {
    const row = yield* Class;
    const folder = yield* classFolder(folderId);
    const folders = yield* classFolders(row._id);
    const kept =
      folder.parentId !== undefined &&
      Arr.some(folders, (found) => found._id === folder.parentId);
    yield* (yield* DatabaseWriter)
      .table("classroomFolders")
      .patch(folderId, {
        parentId: kept ? folder.parentId : undefined,
        trashedAt: undefined,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Deletes a folder forever with every folder and item inside it. */
const purge = FunctionImpl.make(
  databaseSchema,
  spec,
  "purge",
  Effect.fn("classroom.folders.purge")(function* ({ folderId }) {
    const row = yield* Class;
    yield* classFolder(folderId);
    yield* purgeTree(row._id, folderId);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(add),
  Layer.provide(rename),
  Layer.provide(move),
  Layer.provide(trash),
  Layer.provide(restore),
  Layer.provide(purge),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
