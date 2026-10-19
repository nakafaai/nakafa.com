import { FunctionImpl, GroupImpl } from "@confect/server";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
  StorageReader,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  ASSET_BYTE_LIMIT,
  AssetSizeRefused,
  AssetTypeRefused,
} from "@repo/backend/confect/exams/asset";
import spec from "@repo/backend/confect/exams/assets.spec";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** How many images one call of `removeForExam` deletes. */
const REMOVE_BATCH = 16;

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
 * Registers an uploaded file as an image of the exam. The teacher's right to add an image is
 * checked first, then the file's leading bytes name its type, which the editor accepts only as
 * PNG, JPEG, WebP, or GIF, and its size is checked against the limit. A file that passes is
 * stored as an image; a file that does not is deleted, and the refusal names why.
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
      const blob = yield* (yield* StorageActionWriter)
        .get(storageId)
        .pipe(Effect.orDie);
      if (blob.size > ASSET_BYTE_LIMIT) {
        yield* refuse(storageId);
        return yield* new AssetSizeRefused();
      }
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
              byteSize: blob.size,
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
    const reader = yield* DatabaseReader;
    const rows = yield* Effect.forEach(assets, (id) =>
      reader
        .table("examAssets")
        .get(id)
        .pipe(
          Effect.asSome,
          Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
          Effect.orDie
        )
    );
    const storage = yield* StorageReader;
    const answers = yield* Effect.forEach(Arr.getSomes(rows), (row) =>
      row.examId === examId
        ? storage.getUrl(row.storageId).pipe(
            Effect.map((url) => ({ id: row._id, url: url.href })),
            Effect.asSome,
            Effect.orDie
          )
        : Effect.fail(
            new AccessDenied({ action: "exam.view", reason: "resource" })
          )
    );
    return Arr.getSomes(answers);
  })
);

/**
 * Deletes one batch of the images of an exam with their files. An exam that is removed calls
 * this until it answers `done`, so every image of the exam goes with it.
 */
const removeForExam = FunctionImpl.make(
  databaseSchema,
  spec,
  "removeForExam",
  Effect.fn("exams.assets.removeForExam")(function* ({ examId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const storage = yield* StorageWriter;
    const rows = yield* reader
      .table("examAssets")
      .index("by_examId", (q) => q.eq("examId", examId))
      .take(REMOVE_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(rows, (row) =>
      Effect.all([
        writer.table("examAssets").delete(row._id),
        storage.delete(row.storageId),
      ]).pipe(Effect.orDie)
    );
    return { done: rows.length < REMOVE_BATCH };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(uploadUrl),
  Layer.provide(canAdd),
  Layer.provide(register),
  Layer.provide(commit),
  Layer.provide(discard),
  Layer.provide(urls),
  Layer.provide(removeForExam),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
