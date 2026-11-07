import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomUploadsDoc } from "@repo/backend/confect/_generated/docs";
import bucketInternal from "@repo/backend/confect/_generated/refs/bucket.server";
import classroomPublic from "@repo/backend/confect/_generated/refs/classroom";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { deleteFile, reserveUpload } from "@repo/backend/confect/bucket/file";
import { inspectFile } from "@repo/backend/confect/bucket/stored";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { FileSizeRefused } from "@repo/backend/confect/classroom/errors";
import {
  attachmentField,
  attachmentTypeOf,
  THUMBNAIL_BYTE_LIMIT,
} from "@repo/backend/confect/classroom/forum/attachment";
import { AttachmentRefused } from "@repo/backend/confect/classroom/forum/errors";
import spec from "@repo/backend/confect/classroom/forum/files.spec";
import { missing } from "@repo/backend/confect/classroom/forum/lookup";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  HEAD_BYTES,
  LIBRARY_BYTE_LIMIT,
} from "@repo/backend/confect/classroom/library/file";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Duration, Effect, Layer, Option } from "effect";

/** A file of the bucket that a chat upload names. */
type FileId = GenericId.GenericId<"bucketFiles">;

/** How long an upload may wait for its message, which covers a teacher who leaves a draft overnight. */
const UNSENT_LIFETIME = Duration.days(1);

/** How many unsent files one daily sweep deletes. What stays waits for the next day, so a sweep's size stays bounded. */
const SWEEP_BATCH = 256;

/**
 * Reserves one file of a chat, or a photo's small copy, before any byte moves: a file over the library's limit is
 * refused, and any other charges the school's bytes and answers the R2 address it is uploaded to, which binds its
 * length and type.
 */
const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("classroom.forum.files.reserve")(function* ({
    byteSize,
    contentType,
  }) {
    const row = yield* Class;
    if (byteSize > LIBRARY_BYTE_LIMIT) {
      return yield* new FileSizeRefused();
    }
    return yield* reserveUpload({
      byteSize,
      contentType,
      tenantId: row.tenantId,
    });
  })
);

/** The caller's Person in the school, once the middleware of the function allowed them to write in the class. */
const canAttach = FunctionImpl.make(
  databaseSchema,
  spec,
  "canAttach",
  Effect.fn("classroom.forum.files.canAttach")(function* () {
    const { person } = yield* Member;
    return { authorId: person._id };
  })
);

/** The Person who may send a file, asked of the function's own check; one who is no member is refused. */
const attacher = Effect.fn("classroom.forum.files.attacher")(function* (
  classId: GenericId.GenericId<"classes">,
  slug: TenantSlug
) {
  const { runQuery } = yield* QueryRunner;
  return yield* runQuery(classroomPublic.forum.files.canAttach, {
    classId,
    slug,
  }).pipe(
    Effect.catchTag("NotMember", () =>
      Effect.fail(new AccessDenied({ action: "forum.post", reason: "role" }))
    )
  );
});

/** Deletes the files of a refused upload, so a refused file is never stored. */
const discardAll = (files: readonly FileId[]) =>
  Effect.gen(function* () {
    const { runMutation } = yield* MutationRunner;
    yield* Effect.forEach(files, (fileId) =>
      runMutation(bucketInternal.discard, { fileId })
    );
  });

/** What R2 holds of an uploaded file: its size and leading bytes, or nothing when its bytes never arrived. */
const storedOf = (fileId: FileId) => inspectFile(fileId, HEAD_BYTES);

/**
 * Registers an uploaded file as one its author may send. The right to write in the
 * class is checked first, then the sizes, before any bytes are read. The leading
 * bytes name the type, so a file keeps its kind whatever its name or its declared
 * type says, and a small copy must be an image. A file that passes waits for its
 * message; any other is deleted with its small copy, and the refusal names why.
 */
const register = FunctionImpl.make(
  databaseSchema,
  spec,
  "register",
  Effect.fn("classroom.forum.files.register")(
    function* ({ classId, fileId, height, name, slug, thumbnailId, width }) {
      yield* requireAuth();
      const { authorId } = yield* attacher(classId, slug);
      const files = Arr.appendAll(
        [fileId],
        thumbnailId === null ? [] : [thumbnailId]
      );
      const stored = yield* storedOf(fileId);
      const small =
        thumbnailId === null ? Option.none() : yield* storedOf(thumbnailId);
      if (
        Option.isNone(stored) ||
        (thumbnailId !== null && Option.isNone(small))
      ) {
        yield* discardAll(files);
        return yield* new AttachmentRefused();
      }
      const { byteSize, head } = stored.value;
      if (
        Option.exists(small, (copy) => copy.byteSize > THUMBNAIL_BYTE_LIMIT)
      ) {
        yield* discardAll(files);
        return yield* new FileSizeRefused();
      }
      const contentType = attachmentTypeOf(head, name);
      const smallIsImage = !Option.exists(small, (copy) =>
        Option.isNone(imageTypeOf(copy.head))
      );
      if (Option.isNone(contentType) || !smallIsImage) {
        yield* discardAll(files);
        return yield* new AttachmentRefused();
      }
      const { runMutation } = yield* MutationRunner;
      return yield* runMutation(classroomInternal.forum.files.commit, {
        authorId,
        byteSize,
        classId,
        contentType: contentType.value,
        fileId,
        height,
        kind: Option.isSome(imageTypeOf(head)) ? "image" : "document",
        name,
        thumbnailId,
        width,
      });
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/** Stores a registered upload in the class's school, its name sealed with the school key. Its bytes were charged at its reservation. */
const commit = FunctionImpl.make(
  databaseSchema,
  spec,
  "commit",
  Effect.fn("classroom.forum.files.commit")(function* ({
    authorId,
    byteSize,
    classId,
    contentType,
    height,
    kind,
    fileId,
    name,
    thumbnailId,
    width,
  }) {
    const row = yield* (yield* DatabaseReader)
      .table("classes")
      .get(classId)
      .pipe(Effect.orDie);
    const id = yield* (yield* DatabaseWriter)
      .table("classroomUploads")
      .insert({
        authorId,
        byteSize,
        classId,
        contentType,
        createdAt: yield* Clock.currentTimeMillis,
        kind,
        sealedName: yield* sealText(
          yield* schoolKeys(row.tenantId),
          attachmentField({ classId, fileId }),
          name
        ).pipe(Effect.orDie),
        fileId,
        tenantId: row.tenantId,
        ...(height === null ? {} : { height }),
        ...(thumbnailId === null ? {} : { thumbnailId }),
        ...(width === null ? {} : { width }),
      })
      .pipe(Effect.orDie);
    return { byteSize, id, kind };
  })
);

/** Deletes one unsent upload with its files, whose bytes go back to its school. */
const dropUpload = Effect.fn("classroom.forum.files.drop")(function* (
  upload: ClassroomUploadsDoc
) {
  yield* Effect.forEach(
    Arr.appendAll(
      [upload.fileId],
      upload.thumbnailId === undefined ? [] : [upload.thumbnailId]
    ),
    deleteFile
  );
  yield* (yield* DatabaseWriter)
    .table("classroomUploads")
    .delete(upload._id)
    .pipe(Effect.orDie);
});

/** Takes back a file its author has not sent. Another person's upload is refused as a missing object. */
const withdraw = FunctionImpl.make(
  databaseSchema,
  spec,
  "withdraw",
  Effect.fn("classroom.forum.files.withdraw")(function* ({ uploadId }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const upload = yield* (yield* DatabaseReader)
      .table("classroomUploads")
      .get(uploadId)
      .pipe(Effect.option);
    if (
      Option.isNone(upload) ||
      upload.value.authorId !== person._id ||
      upload.value.classId !== row._id
    ) {
      return yield* missing("forum.post");
    }
    yield* dropUpload(upload.value);
    return null;
  })
);

/** Deletes the uploads that stayed unsent past their lifetime. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("classroom.forum.files.sweep")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const stale = yield* (yield* DatabaseReader)
      .table("classroomUploads")
      .index("by_createdAt", (query) =>
        query.lt("createdAt", now - Duration.toMillis(UNSENT_LIFETIME))
      )
      .take(SWEEP_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(stale, dropUpload);
    return { deleted: stale.length };
  }, Effect.orDie)
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reserve),
  Layer.provide(canAttach),
  Layer.provide(register),
  Layer.provide(commit),
  Layer.provide(withdraw),
  Layer.provide(sweep),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
