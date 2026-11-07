import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import classroomPublic from "@repo/backend/confect/_generated/refs/classroom";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  inspectObject,
  putObject,
  removeObject,
} from "@repo/backend/confect/bucket/object";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  FileSizeRefused,
  FileTypeRefused,
  UploadMissing,
} from "@repo/backend/confect/classroom/errors";
import {
  fileTypeOf,
  HEAD_BYTES,
  LIBRARY_BYTE_LIMIT,
} from "@repo/backend/confect/classroom/library/file";
import { itemPlace } from "@repo/backend/confect/classroom/library/place";
import {
  releaseUpload,
  reserveUpload,
  uploadAddress,
} from "@repo/backend/confect/classroom/library/reserve";
import spec from "@repo/backend/confect/classroom/library.spec";
import { ConnectorOff } from "@repo/backend/confect/connectors/errors";
import {
  driveBytes,
  driveFile,
} from "@repo/backend/confect/connectors/google/drive";
import { ownDriveAccess } from "@repo/backend/confect/connectors/google/grant";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { FetchClient } from "@repo/utilities/http/client";
import { Duration, Effect, Option, Schedule } from "effect";

/** How an action retries R2 before a failure is a defect: three more tries, the wait doubling from 200 ms. */
const BUCKET_RETRY = {
  schedule: Schedule.exponential(Duration.millis(200)),
  times: 3,
};

/**
 * Reserves the bytes of one upload of the caller and answers the address the browser uploads it to. The address
 * binds the reserved length and type and lives fifteen minutes.
 */
export const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("classroom.library.reserveUpload")(function* (args) {
    const { person } = yield* Member;
    const reservation = yield* reserveUpload(yield* Class, {
      ...args,
      authorId: person._id,
    });
    return {
      address: yield* uploadAddress(reservation),
      uploadId: reservation._id,
    };
  })
);

/** The caller's Person in the school, once the middleware of the function allowed it to add to the library. */
export const canAdd = FunctionImpl.make(
  databaseSchema,
  spec,
  "canAdd",
  Effect.fn("classroom.library.canAdd")(function* () {
    const { person } = yield* Member;
    return { authorId: person._id };
  })
);

/** Reserves the bytes of a file the server imports itself, for a Person the action already checked. */
export const reserveImport = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserveImport",
  Effect.fn("classroom.library.reserveImport")(function* (args) {
    const row = yield* (yield* DatabaseReader)
      .table("classes")
      .get(args.classId)
      .pipe(Effect.orDie);
    const reservation = yield* reserveUpload(row, args);
    return { objectKey: reservation.objectKey, uploadId: reservation._id };
  })
);

/** What a reservation holds that registering checks, when it still exists. */
export const upload = FunctionImpl.make(
  databaseSchema,
  spec,
  "upload",
  Effect.fn("classroom.library.upload")(function* ({ uploadId }) {
    const found = yield* (yield* DatabaseReader)
      .table("classroomLibraryUploads")
      .get(uploadId)
      .pipe(Effect.option);
    return Option.match(found, {
      onNone: () => null,
      onSome: (reservation) => ({
        byteSize: reservation.byteSize,
        classId: reservation.classId,
        contentType: reservation.contentType,
        objectKey: reservation.objectKey,
      }),
    });
  })
);

/**
 * Turns a reservation into an item of the library at its folder, its sealed title copied unchanged, and schedules
 * the passages of the file. Its bytes stay charged, now as the item's. A repeat of a client key of the class keeps
 * the item it made, frees the repeat's bytes and removes its object. A reservation the sweep already freed is
 * refused as an upload that did not arrive.
 */
export const commit = FunctionImpl.make(
  databaseSchema,
  spec,
  "commit",
  Effect.fn("classroom.library.commit")(function* ({ uploadId }) {
    const reader = yield* DatabaseReader;
    const found = yield* reader
      .table("classroomLibraryUploads")
      .get(uploadId)
      .pipe(Effect.option);
    if (Option.isNone(found)) {
      return yield* new UploadMissing();
    }
    const reservation = found.value;
    const scheduler = yield* Scheduler;
    const sent = yield* reader
      .table("classroomLibrary")
      .index("by_classId_and_clientKey", (query) =>
        query
          .eq("classId", reservation.classId)
          .eq("clientKey", reservation.clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sent)) {
      yield* releaseUpload(uploadId, reservation);
      yield* scheduler.runAfter(
        Duration.zero,
        classroomInternal.library.removeObjects,
        { keys: [reservation.objectKey] }
      );
      return { id: sent.value._id };
    }
    const writer = yield* DatabaseWriter;
    const id = yield* writer
      .table("classroomLibrary")
      .insert({
        ...(yield* itemPlace(
          reservation.classId,
          reservation.folderId ?? null
        )),
        authorId: reservation.authorId,
        byteSize: reservation.byteSize,
        classId: reservation.classId,
        clientKey: reservation.clientKey,
        contentType: reservation.contentType,
        createdAt: reservation.createdAt,
        kind: "file",
        objectKey: reservation.objectKey,
        sealedTitle: reservation.sealedTitle,
        tenantId: reservation.tenantId,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("classroomLibraryUploads")
      .delete(uploadId)
      .pipe(Effect.orDie);
    yield* scheduler.runAfter(Duration.zero, classroomInternal.passages.build, {
      itemId: id,
    });
    return { id };
  })
);

/** Frees a reservation whose file the server refused, and removes whatever object arrived. */
export const discard = FunctionImpl.make(
  databaseSchema,
  spec,
  "discard",
  Effect.fn("classroom.library.discard")(function* ({ uploadId }) {
    const found = yield* (yield* DatabaseReader)
      .table("classroomLibraryUploads")
      .get(uploadId)
      .pipe(Effect.option);
    if (Option.isNone(found)) {
      return null;
    }
    yield* releaseUpload(uploadId, found.value);
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      classroomInternal.library.removeObjects,
      { keys: [found.value.objectKey] }
    );
    return null;
  })
);

/** Removes objects from the bucket, each retried, so a deleted file leaves no bytes behind. */
export const removeObjects = FunctionImpl.make(
  databaseSchema,
  spec,
  "removeObjects",
  Effect.fn("classroom.library.removeObjects")(
    function* ({ keys }) {
      yield* Effect.forEach(
        keys,
        (key) => removeObject(key).pipe(Effect.retry(BUCKET_RETRY)),
        { concurrency: 4, discard: true }
      );
      return null;
    },
    Effect.provide(FetchClient),
    Effect.orDie
  )
);

/** The Person who may add to the library, asked of the library's own check; one who is no member is refused. */
const libraryAuthor = Effect.fn("classroom.library.author")(function* (
  classId: GenericId.GenericId<"classes">,
  slug: TenantSlug
) {
  const { runQuery } = yield* QueryRunner;
  return yield* runQuery(classroomPublic.library.canAdd, {
    classId,
    slug,
  }).pipe(
    Effect.catchTag("NotMember", () =>
      Effect.fail(
        new AccessDenied({ action: "library.manage", reason: "role" })
      )
    )
  );
});

/**
 * Registers an uploaded file as an item of the library. The right to add is checked first, then R2 is asked for
 * the object: its size must be the size reserved, which the upload address already bound, and its leading bytes
 * must name the type reserved. A file that fails is removed and its bytes freed, and the refusal names why.
 */
export const register = FunctionImpl.make(
  databaseSchema,
  spec,
  "register",
  Effect.fn("classroom.library.register")(
    function* ({ classId, slug, uploadId }) {
      yield* requireAuth();
      yield* libraryAuthor(classId, slug);
      const { runMutation } = yield* MutationRunner;
      const { runQuery } = yield* QueryRunner;
      const reservation = yield* runQuery(classroomInternal.library.upload, {
        uploadId,
      });
      if (reservation === null || reservation.classId !== classId) {
        return yield* new UploadMissing();
      }
      const stored = yield* inspectObject(
        reservation.objectKey,
        HEAD_BYTES
      ).pipe(Effect.retry(BUCKET_RETRY), Effect.orDie);
      if (Option.isNone(stored)) {
        return yield* new UploadMissing();
      }
      const type = fileTypeOf(stored.value.head);
      if (
        stored.value.byteSize !== reservation.byteSize ||
        Option.getOrNull(type) !== reservation.contentType
      ) {
        yield* runMutation(classroomInternal.library.discard, { uploadId });
        return yield* new FileTypeRefused();
      }
      return yield* runMutation(classroomInternal.library.commit, { uploadId });
    },
    Effect.provide(FetchClient),
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * Imports a file the teacher picked in Google Drive into the library. The teacher's own Drive connection reads it,
 * which covers only the files the teacher picked with Nakafa. Its size is read first, so a file over the limit, or
 * a Google document, which has no size because it is no stored file, is refused before any byte is read. Its
 * leading bytes must name a PDF or an image. Its bytes are reserved, written to R2, and kept as an upload is.
 */
export const importDrive = FunctionImpl.make(
  databaseSchema,
  spec,
  "importDrive",
  Effect.fn("classroom.library.importDrive")(
    function* ({ classId, clientKey, fileId, folderId, slug, title }) {
      const { appUser } = yield* requireAuth();
      const { authorId } = yield* libraryAuthor(classId, slug);
      const access = yield* ownDriveAccess(appUser._id);
      if (Option.isNone(access)) {
        return yield* new ConnectorOff();
      }
      const file = yield* driveFile(access.value, fileId);
      if (file.size === undefined) {
        return yield* new FileTypeRefused();
      }
      if (file.size > LIBRARY_BYTE_LIMIT) {
        return yield* new FileSizeRefused();
      }
      const bytes = new Uint8Array(yield* driveBytes(access.value, fileId));
      const contentType = fileTypeOf(bytes.slice(0, HEAD_BYTES));
      if (Option.isNone(contentType)) {
        return yield* new FileTypeRefused();
      }
      const { runMutation } = yield* MutationRunner;
      const reservation = yield* runMutation(
        classroomInternal.library.reserveImport,
        {
          authorId,
          byteSize: bytes.byteLength,
          classId,
          clientKey,
          contentType: contentType.value,
          folderId,
          title,
        }
      );
      yield* putObject(reservation.objectKey, bytes, contentType.value).pipe(
        Effect.retry(BUCKET_RETRY),
        Effect.orDie
      );
      return yield* runMutation(classroomInternal.library.commit, {
        uploadId: reservation.uploadId,
      });
    },
    Effect.provide(FetchClient),
    Effect.catchTag("SchemaError", Effect.die)
  )
);
