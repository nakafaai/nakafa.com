import { BlobNotFoundError, FunctionImpl, GroupImpl } from "@confect/server";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryCtx,
  QueryRunner,
  StorageActionWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { addressesOf } from "@repo/backend/confect/exams/addresses";
import {
  AssetSizeRefused,
  AssetTypeRefused,
} from "@repo/backend/confect/exams/asset";
import spec from "@repo/backend/confect/exams/assets.spec";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { Clock, Effect, Layer, Option } from "effect";

/** The ID of an uploaded file in Convex storage. */
const storageIdSchema = Id("_storage");
type StorageId = typeof storageIdSchema.Type;

/** The bytes at the start of a file that `imageTypeOf` reads, which covers every signature. */
const HEAD_BYTES = 16;

/** The address that the file of an image is uploaded to. The upload answers with the storage ID that `register` names. */
const uploadUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "uploadUrl",
  Effect.fn("exams.assets.uploadUrl")(function* () {
    return yield* (yield* StorageWriter).generateUploadUrl;
  })
);

/** Answers nothing, because the middleware of the function is the check: a teacher who may edit the exam may add an image. */
const canAdd = FunctionImpl.make(
  databaseSchema,
  spec,
  "canAdd",
  Effect.fn("exams.assets.canAdd")(() => Effect.succeed({}))
);

/**
 * Deletes an uploaded file that the server refuses, so a refused file is never stored. The
 * refusal is the typed error the caller answers with, and the delete commits before it.
 */
const refuse = (storageId: StorageId) =>
  Effect.gen(function* () {
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(refs.internal.exams.assets.discard, { storageId });
  });

/**
 * The size of an uploaded file, read from the storage system table in a query. The size comes
 * before the download, so `register` refuses an oversize file without reading its bytes. A file
 * that the storage no longer holds is a defect, because the upload that named it has finished.
 */
const stored = FunctionImpl.make(
  databaseSchema,
  spec,
  "stored",
  Effect.fn("exams.assets.stored")(function* ({ storageId }) {
    const ctx = yield* QueryCtx;
    const metadata = yield* Effect.tryPromise(() =>
      ctx.db.system.get("_storage", storageId)
    ).pipe(Effect.orDie);
    return yield* Option.match(Option.fromNullishOr(metadata), {
      onNone: () =>
        Effect.die(new BlobNotFoundError.BlobNotFoundError({ id: storageId })),
      onSome: (file) => Effect.succeed({ size: file.size }),
    });
  })
);

/**
 * Registers an uploaded file as an image of the exam. The teacher's right to add an image is
 * checked first, then the file's size is checked against the limit, before its bytes are read.
 * The leading bytes name the file's type, which the editor accepts only as PNG, JPEG, WebP, or
 * GIF. A file that passes is stored as an image; a file that does not is deleted, and the
 * refusal names why.
 */
const register = FunctionImpl.make(
  databaseSchema,
  spec,
  "register",
  Effect.fn("exams.assets.register")(
    function* ({ examId, height, slug, storageId, width }) {
      const { appUser } = yield* requireAuth();
      const { runQuery } = yield* QueryRunner;
      yield* runQuery(refs.public.exams.assets.canAdd, { examId, slug }).pipe(
        Effect.catchTag("NotMember", () =>
          Effect.fail(new AccessDenied({ action: "exam.edit", reason: "role" }))
        )
      );
      const { size } = yield* runQuery(refs.internal.exams.assets.stored, {
        storageId,
      }).pipe(Effect.orDie);
      if (size > IMAGE_BYTE_LIMIT) {
        yield* refuse(storageId);
        return yield* new AssetSizeRefused();
      }
      const blob = yield* (yield* StorageActionWriter)
        .get(storageId)
        .pipe(Effect.orDie);
      const head = new Uint8Array(
        yield* Effect.promise(() => blob.slice(0, HEAD_BYTES).arrayBuffer())
      );
      return yield* Option.match(imageTypeOf(head), {
        onNone: () =>
          refuse(storageId).pipe(
            Effect.andThen(Effect.fail(new AssetTypeRefused()))
          ),
        onSome: (contentType) =>
          Effect.gen(function* () {
            const { runMutation } = yield* MutationRunner;
            return yield* runMutation(refs.internal.exams.assets.commit, {
              byteSize: size,
              contentType,
              examId,
              height,
              storageId,
              userId: appUser._id,
              width,
            });
          }),
      });
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * Stores the row of a registered image, in the exam's school. The exam's tenant is read from
 * the exam, so the image belongs to the school that holds its exam.
 */
const commit = FunctionImpl.make(
  databaseSchema,
  spec,
  "commit",
  Effect.fn("exams.assets.commit")(function* (args) {
    const exam = yield* (yield* DatabaseReader)
      .table("exams")
      .get(args.examId)
      .pipe(Effect.orDie);
    const createdAt = yield* Clock.currentTimeMillis;
    const id = yield* (yield* DatabaseWriter)
      .table("examAssets")
      .insert({
        byteSize: args.byteSize,
        contentType: args.contentType,
        createdAt,
        createdBy: args.userId,
        examId: args.examId,
        height: args.height,
        storageId: args.storageId,
        tenantId: exam.tenantId,
        width: args.width,
      })
      .pipe(Effect.orDie);
    return { id };
  })
);

/** Deletes a refused or abandoned file. */
const discard = FunctionImpl.make(
  databaseSchema,
  spec,
  "discard",
  Effect.fn("exams.assets.discard")(function* ({ storageId }) {
    yield* (yield* StorageWriter).delete(storageId).pipe(Effect.orDie);
    return {};
  })
);

/**
 * The addresses of the images of one prompt, in one read. An image of another exam is refused
 * as an access denial, so no address of another school's file leaves this read. An image that
 * no longer exists is left out of the answer.
 */
const urls = FunctionImpl.make(
  databaseSchema,
  spec,
  "urls",
  Effect.fn("exams.assets.urls")(function* ({ assets, examId }) {
    return yield* addressesOf(examId, assets);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(uploadUrl),
  Layer.provide(canAdd),
  Layer.provide(register),
  Layer.provide(commit),
  Layer.provide(discard),
  Layer.provide(stored),
  Layer.provide(urls),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
