import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import type { ClassroomLibraryDoc } from "@repo/backend/confect/_generated/docs";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { refundBucket } from "@repo/backend/confect/bucket/use";
import { Class } from "@repo/backend/confect/classroom/access";
import { refundBytes } from "@repo/backend/confect/classroom/forum/use";
import { dropPassages } from "@repo/backend/confect/classroom/library/drop";
import { classItem } from "@repo/backend/confect/classroom/library/edit";
import {
  RESERVATION_AGE,
  releaseUpload,
} from "@repo/backend/confect/classroom/library/reserve";
import {
  classFolders,
  hiddenFolders,
  subtree,
} from "@repo/backend/confect/classroom/library/tree";
import spec from "@repo/backend/confect/classroom/library.spec";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  HashSet,
  Option,
  Result,
} from "effect";

/** How long an item or a folder waits in the trash before the daily sweep deletes it forever. */
export const TRASH_AGE = Duration.days(30);

/** The rows one pass of a deletion or of the sweep reads of each kind, so one transaction stays small. */
const PURGE_BATCH = 64;

/** Removes the objects of deleted files from the bucket, after the transaction that deleted their rows. */
const removeLater = Effect.fn("classroom.library.removeLater")(function* (
  keys: readonly string[]
) {
  if (keys.length === 0) {
    return;
  }
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    classroomInternal.library.removeObjects,
    { keys: [...keys] }
  );
});

/**
 * Deletes items forever: their passages, the stars that name them, and their rows. A file's bytes leave the
 * school's use and the bucket's at once, and its object leaves the bucket right after.
 */
export const purgeItems = Effect.fn("classroom.library.purgeItems")(function* (
  rows: readonly ClassroomLibraryDoc[]
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    rows,
    (item) =>
      Effect.gen(function* () {
        yield* dropPassages(item._id);
        const stars = yield* reader
          .table("classroomStars")
          .index("by_itemId", (query) => query.eq("itemId", item._id))
          .collect()
          .pipe(Effect.orDie);
        yield* Effect.forEach(
          stars,
          (found) => writer.table("classroomStars").delete(found._id),
          { discard: true }
        ).pipe(Effect.orDie);
        yield* writer
          .table("classroomLibrary")
          .delete(item._id)
          .pipe(Effect.orDie);
        if (item.kind === "file") {
          yield* refundBytes(item.tenantId, item.byteSize);
          yield* refundBucket(item.byteSize);
        }
      }),
    { discard: true }
  );
  yield* removeLater(
    Arr.filterMap(rows, (item) =>
      item.kind === "file" ? Result.succeed(item.objectKey) : Result.failVoid
    )
  );
});

/**
 * Deletes some folders forever with their stars, and the items inside them a batch at a time: a folder whose items
 * fill a batch leaves the rest to a later pass, which reads them by the folder that no longer exists.
 */
export const purgeFolders = Effect.fn("classroom.library.purgeFolders")(
  function* (
    classId: GenericId.GenericId<"classes">,
    folderIds: readonly GenericId.GenericId<"classroomFolders">[]
  ) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const items = yield* Effect.forEach(folderIds, (folderId) =>
      reader
        .table("classroomLibrary")
        .index("by_classId_and_folderId_and_trashedAt", (query) =>
          query.eq("classId", classId).eq("folderId", folderId)
        )
        .take(PURGE_BATCH)
        .pipe(Effect.orDie)
    );
    yield* purgeItems(Arr.flatten(items));
    yield* Effect.forEach(
      folderIds,
      (folderId) =>
        Effect.gen(function* () {
          const stars = yield* reader
            .table("classroomStars")
            .index("by_folderId", (query) => query.eq("folderId", folderId))
            .collect()
            .pipe(Effect.orDie);
          yield* Effect.forEach(
            stars,
            (found) => writer.table("classroomStars").delete(found._id),
            { discard: true }
          ).pipe(Effect.orDie);
          const folder = yield* reader
            .table("classroomFolders")
            .get(folderId)
            .pipe(Effect.option);
          if (Option.isSome(folder)) {
            yield* writer
              .table("classroomFolders")
              .delete(folderId)
              .pipe(Effect.orDie);
          }
        }),
      { discard: true }
    );
    const remaining = Arr.filterMap(
      Arr.zip(folderIds, items),
      ([folderId, found]) =>
        found.length === PURGE_BATCH
          ? Result.succeed(folderId)
          : Result.failVoid
    );
    if (remaining.length > 0) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        classroomInternal.library.purgeRest,
        { classId, folderIds: remaining }
      );
    }
  }
);

/** One folder and every folder inside it, deleted forever with everything they hold. */
export const purgeTree = Effect.fn("classroom.library.purgeTree")(function* (
  classId: GenericId.GenericId<"classes">,
  folderId: GenericId.GenericId<"classroomFolders">
) {
  const folders = yield* classFolders(classId);
  const inside = subtree(folders, folderId);
  yield* purgeFolders(
    classId,
    Arr.filterMap(folders, (folder) =>
      HashSet.has(inside, folder._id)
        ? Result.succeed(folder._id)
        : Result.failVoid
    )
  );
});

/** Moves an item of the class to the trash, where it keeps its place and its bytes. */
export const trash = FunctionImpl.make(
  databaseSchema,
  spec,
  "trash",
  Effect.fn("classroom.library.trash")(function* ({ itemId }) {
    yield* classItem(itemId);
    yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .patch(itemId, { trashedAt: yield* Clock.currentTimeMillis })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Brings an item back from the trash to its folder, or to the top of the library when its folder is gone or in the trash. */
export const restore = FunctionImpl.make(
  databaseSchema,
  spec,
  "restore",
  Effect.fn("classroom.library.restore")(function* ({ itemId }) {
    const row = yield* Class;
    const item = yield* classItem(itemId);
    const folders = yield* classFolders(row._id);
    const hidden = hiddenFolders(folders);
    const kept =
      item.folderId !== undefined &&
      Arr.some(folders, (folder) => folder._id === item.folderId) &&
      !HashSet.has(hidden, item.folderId);
    yield* (yield* DatabaseWriter)
      .table("classroomLibrary")
      .patch(itemId, {
        folderId: kept ? item.folderId : undefined,
        trashedAt: undefined,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Deletes an item of the class forever, which revokes every address of its file (ADR 0028). */
export const purge = FunctionImpl.make(
  databaseSchema,
  spec,
  "purge",
  Effect.fn("classroom.library.purge")(function* ({ itemId }) {
    yield* purgeItems([yield* classItem(itemId)]);
    return null;
  })
);

/** The next pass of a folder deletion, for the items its first pass left. */
export const purgeRest = FunctionImpl.make(
  databaseSchema,
  spec,
  "purgeRest",
  Effect.fn("classroom.library.purgeRest")(function* ({ classId, folderIds }) {
    yield* purgeFolders(classId, folderIds);
    return null;
  })
);

/**
 * The daily retention sweep: reservations whose upload never registered free their bytes and objects, and items
 * and folders that waited in the trash for `TRASH_AGE` are deleted forever. A full batch of any kind runs the sweep
 * again at once.
 */
export const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("classroom.library.sweep")(function* () {
    const reader = yield* DatabaseReader;
    const now = yield* Clock.currentTimeMillis;
    const stale = yield* reader
      .table("classroomLibraryUploads")
      .index("by_createdAt", (query) =>
        query.lt("createdAt", now - Duration.toMillis(RESERVATION_AGE))
      )
      .take(PURGE_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      stale,
      (reservation) => releaseUpload(reservation._id, reservation),
      { discard: true }
    );
    yield* removeLater(Arr.map(stale, (reservation) => reservation.objectKey));
    const cutoff = now - Duration.toMillis(TRASH_AGE);
    const items = yield* reader
      .table("classroomLibrary")
      .index("by_trashedAt", (query) =>
        query.gt("trashedAt", 0).lt("trashedAt", cutoff)
      )
      .take(PURGE_BATCH)
      .pipe(Effect.orDie);
    yield* purgeItems(items);
    const folders = yield* reader
      .table("classroomFolders")
      .index("by_trashedAt", (query) =>
        query.gt("trashedAt", 0).lt("trashedAt", cutoff)
      )
      .take(PURGE_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      folders,
      (folder) => purgeTree(folder.classId, folder._id),
      { discard: true }
    );
    if (
      Arr.some([stale, items, folders], (batch) => batch.length === PURGE_BATCH)
    ) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        classroomInternal.library.sweep,
        {}
      );
    }
    return null;
  })
);
