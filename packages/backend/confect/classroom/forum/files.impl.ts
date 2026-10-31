import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomUploadsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  Scheduler,
  StorageActionWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { FileSizeRefused } from "@repo/backend/confect/classroom/errors";
import {
  attachmentField,
  attachmentTypeOf,
  THUMBNAIL_BYTE_LIMIT,
} from "@repo/backend/confect/classroom/forum/attachment";
import {
  AttachmentRefused,
  FileQuotaReached,
} from "@repo/backend/confect/classroom/forum/errors";
import spec from "@repo/backend/confect/classroom/forum/files.spec";
import { missing } from "@repo/backend/confect/classroom/forum/lookup";
import {
  chargeBytes,
  refundBytes,
} from "@repo/backend/confect/classroom/forum/use";
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

/** An uploaded file's ID in Convex storage. */
type StorageId = GenericId.GenericId<"_storage">;

/** How long an upload may wait for its message, which covers a teacher who leaves a draft overnight. */
const UNSENT_LIFETIME = Duration.days(1);

/** How many unsent files one sweep deletes before it runs again. */
const SWEEP_BATCH = 64;

/** The address that a file of a chat is uploaded to. The upload answers with the storage ID that `register` names. */
const uploadUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "uploadUrl",
  Effect.fn("classroom.forum.files.uploadUrl")(function* () {
    return yield* (yield* StorageWriter).generateUploadUrl;
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
  return yield* runQuery(refs.public.classroom.forum.files.canAttach, {
    classId,
    slug,
  }).pipe(
    Effect.catchTag("NotMember", () =>
      Effect.fail(new AccessDenied({ action: "forum.post", reason: "role" }))
    )
  );
});

/** Deletes the files of a refused upload, so a refused file is never stored. */
const discardAll = (files: readonly StorageId[]) =>
  Effect.gen(function* () {
    const { runMutation } = yield* MutationRunner;
    yield* Effect.forEach(files, (storageId) =>
      runMutation(refs.internal.exams.assets.discard, { storageId })
    );
  });

/** The leading bytes of a stored file, which name its type. */
const headOf = Effect.fn("classroom.forum.files.head")(function* (
  storageId: StorageId
) {
  const blob = yield* (yield* StorageActionWriter)
    .get(storageId)
    .pipe(Effect.orDie);
  return new Uint8Array(
    yield* Effect.promise(() => blob.slice(0, HEAD_BYTES).arrayBuffer())
  );
});

/** The size of a stored file. */
const sizeOf = Effect.fn("classroom.forum.files.size")(function* (
  storageId: StorageId
) {
  const { runQuery } = yield* QueryRunner;
  const { size } = yield* runQuery(refs.internal.exams.assets.stored, {
    storageId,
  }).pipe(Effect.orDie);
  return size;
});

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
    function* ({ classId, height, name, slug, storageId, thumbnailId, width }) {
      yield* requireAuth();
      const { authorId } = yield* attacher(classId, slug);
      const files = Arr.appendAll(
        [storageId],
        thumbnailId === null ? [] : [thumbnailId]
      );
      const byteSize = yield* sizeOf(storageId);
      const small = thumbnailId === null ? 0 : yield* sizeOf(thumbnailId);
      if (byteSize > LIBRARY_BYTE_LIMIT || small > THUMBNAIL_BYTE_LIMIT) {
        yield* discardAll(files);
        return yield* new FileSizeRefused();
      }
      const contentType = attachmentTypeOf(yield* headOf(storageId), name);
      const smallIsImage =
        thumbnailId === null ||
        Option.isSome(imageTypeOf(yield* headOf(thumbnailId)));
      if (Option.isNone(contentType) || !smallIsImage) {
        yield* discardAll(files);
        return yield* new AttachmentRefused();
      }
      const { runMutation } = yield* MutationRunner;
      const upload = yield* runMutation(
        refs.internal.classroom.forum.files.commit,
        {
          authorId,
          byteSize,
          classId,
          contentType: contentType.value,
          height,
          kind: Option.isSome(imageTypeOf(yield* headOf(storageId)))
            ? "image"
            : "document",
          name,
          storageId,
          thumbnailId,
          width,
        }
      );
      if (upload === null) {
        yield* discardAll(files);
        return yield* new FileQuotaReached();
      }
      return upload;
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/** Stores a registered upload in the class's school, its name sealed with the school key, unless the school is full. */
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
    name,
    storageId,
    thumbnailId,
    width,
  }) {
    const row = yield* (yield* DatabaseReader)
      .table("classes")
      .get(classId)
      .pipe(Effect.orDie);
    if (!(yield* chargeBytes(row.tenantId, byteSize))) {
      return null;
    }
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
          attachmentField({ classId, storageId }),
          name
        ).pipe(Effect.orDie),
        storageId,
        tenantId: row.tenantId,
        ...(height === null ? {} : { height }),
        ...(thumbnailId === null ? {} : { thumbnailId }),
        ...(width === null ? {} : { width }),
      })
      .pipe(Effect.orDie);
    return { byteSize, id, kind };
  })
);

/** Deletes one unsent upload with its files, and gives its bytes back to its school. */
const dropUpload = Effect.fn("classroom.forum.files.drop")(function* (
  upload: ClassroomUploadsDoc
) {
  const storage = yield* StorageWriter;
  yield* Effect.forEach(
    Arr.appendAll(
      [upload.storageId],
      upload.thumbnailId === undefined ? [] : [upload.thumbnailId]
    ),
    (storageId) => storage.delete(storageId).pipe(Effect.orDie)
  );
  yield* refundBytes(upload.tenantId, upload.byteSize);
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

/** Deletes the uploads that stayed unsent past their lifetime, a batch at a time. */
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
    if (stale.length === SWEEP_BATCH) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.classroom.forum.files.sweep,
        {}
      );
    }
    return { deleted: stale.length };
  }, Effect.orDie)
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(uploadUrl),
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
