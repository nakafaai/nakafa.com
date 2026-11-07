import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import bucketInternal from "@repo/backend/confect/_generated/refs/bucket.server";
import examsPublic from "@repo/backend/confect/_generated/refs/exams";
import examsInternal from "@repo/backend/confect/_generated/refs/exams.server";
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
import { deleteFile, reserveUpload } from "@repo/backend/confect/bucket/file";
import { inspectFile } from "@repo/backend/confect/bucket/stored";
import { Exam } from "@repo/backend/confect/exams/access";
import { addressesOf } from "@repo/backend/confect/exams/addresses";
import {
  AssetSizeRefused,
  AssetTypeRefused,
  MAX_ASSET_READS,
} from "@repo/backend/confect/exams/asset";
import spec from "@repo/backend/confect/exams/assets.spec";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import {
  AUDIO_BYTE_LIMIT,
  AudioSizeRefused,
  AudioTypeRefused,
  audioTypeOf,
} from "@repo/backend/confect/exams/media";
import { playableMedia } from "@repo/backend/confect/exams/questions/media";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/upload";
import { Array as Arr, Clock, Duration, Effect, Layer, Option } from "effect";

/** A file of the bucket that an image or a clip names. */
type FileId = GenericId.GenericId<"bucketFiles">;

/** The bytes at the start of a file that `imageTypeOf` reads, which covers every signature. */
const HEAD_BYTES = 16;

/**
 * Reserves the file of an image or a clip before any byte moves: a file over its kind's limit is refused, and any
 * other charges the exam's school and answers the R2 address it is uploaded to, which binds its length and type.
 */
const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("exams.assets.reserve")(function* ({
    byteSize,
    contentType,
    kind,
  }) {
    const exam = yield* Exam;
    if (kind === "image" && byteSize > IMAGE_BYTE_LIMIT) {
      return yield* new AssetSizeRefused();
    }
    if (kind === "audio" && byteSize > AUDIO_BYTE_LIMIT) {
      return yield* new AudioSizeRefused();
    }
    return yield* reserveUpload({
      byteSize,
      contentType,
      tenantId: exam.tenantId,
    });
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
const refuse = (fileId: FileId) =>
  Effect.gen(function* () {
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(bucketInternal.discard, { fileId });
  });

/** The teacher's right to add a file to the exam, asked of the exam's own check; one who is no member is refused. */
const mayAdd = Effect.fn("exams.assets.mayAdd")(function* (
  examId: GenericId.GenericId<"exams">,
  slug: TenantSlug
) {
  const { runQuery } = yield* QueryRunner;
  yield* runQuery(examsPublic.assets.canAdd, { examId, slug }).pipe(
    Effect.catchTag("NotMember", () =>
      Effect.fail(new AccessDenied({ action: "exam.edit", reason: "role" }))
    )
  );
});

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
    function* ({ examId, fileId, height, slug, width }) {
      const { appUser } = yield* requireAuth();
      yield* mayAdd(examId, slug);
      const stored = yield* inspectFile(fileId, HEAD_BYTES);
      if (Option.isNone(stored)) {
        return yield* new AssetTypeRefused();
      }
      if (stored.value.byteSize > IMAGE_BYTE_LIMIT) {
        yield* refuse(fileId);
        return yield* new AssetSizeRefused();
      }
      const contentType = imageTypeOf(stored.value.head);
      if (Option.isNone(contentType)) {
        yield* refuse(fileId);
        return yield* new AssetTypeRefused();
      }
      const { runMutation } = yield* MutationRunner;
      return yield* runMutation(examsInternal.assets.commit, {
        byteSize: stored.value.byteSize,
        contentType: contentType.value,
        examId,
        fileId,
        height,
        userId: appUser._id,
        width,
      });
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * Registers an uploaded file as an audio clip of the exam, as `register` does an image: the teacher's right first,
 * then the file's size, before its bytes are read, then the leading bytes name its kind. A file that does not pass
 * is deleted, and the refusal names why.
 */
const registerAudio = FunctionImpl.make(
  databaseSchema,
  spec,
  "registerAudio",
  Effect.fn("exams.assets.registerAudio")(
    function* ({ examId, fileId, slug }) {
      const { appUser } = yield* requireAuth();
      yield* mayAdd(examId, slug);
      const stored = yield* inspectFile(fileId, HEAD_BYTES);
      if (Option.isNone(stored)) {
        return yield* new AudioTypeRefused();
      }
      if (stored.value.byteSize > AUDIO_BYTE_LIMIT) {
        yield* refuse(fileId);
        return yield* new AudioSizeRefused();
      }
      const contentType = audioTypeOf(stored.value.head);
      if (Option.isNone(contentType)) {
        yield* refuse(fileId);
        return yield* new AudioTypeRefused();
      }
      const { runMutation } = yield* MutationRunner;
      return yield* runMutation(examsInternal.assets.commitAudio, {
        byteSize: stored.value.byteSize,
        contentType: contentType.value,
        examId,
        fileId,
        userId: appUser._id,
      });
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/** Stores the row of a registered clip, in the school that holds its exam. */
const commitAudio = FunctionImpl.make(
  databaseSchema,
  spec,
  "commitAudio",
  Effect.fn("exams.assets.commitAudio")(function* (args) {
    const exam = yield* (yield* DatabaseReader)
      .table("exams")
      .get(args.examId)
      .pipe(Effect.orDie);
    const createdAt = yield* Clock.currentTimeMillis;
    const id = yield* (yield* DatabaseWriter)
      .table("examAudio")
      .insert({
        byteSize: args.byteSize,
        contentType: args.contentType,
        createdAt,
        createdBy: args.userId,
        examId: args.examId,
        fileId: args.fileId,
        tenantId: exam.tenantId,
      })
      .pipe(Effect.orDie);
    return { id };
  })
);

/** The media of one question of the exam as a paper plays it, for the teacher's editor and try. */
const media = FunctionImpl.make(
  databaseSchema,
  spec,
  "media",
  Effect.fn("exams.assets.media")(function* ({ examId, questionId }) {
    const question = yield* (yield* DatabaseReader)
      .table("examQuestions")
      .get(questionId)
      .pipe(Effect.orDie);
    if (question.examId !== examId) {
      return yield* new AccessDenied({
        action: "exam.view",
        reason: "resource",
      });
    }
    return yield* playableMedia(question.media);
  })
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
        fileId: args.fileId,
        tenantId: exam.tenantId,
        width: args.width,
      })
      .pipe(Effect.orDie);
    return { id };
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

/** Deletes a stored file that no row names any more: a duplicate's rows name the files of the exam it came from. */
const deleteUnsharedFile = Effect.fn("exams.assets.deleteUnshared")(function* (
  fileId: FileId
) {
  const reader = yield* DatabaseReader;
  const pictures = yield* reader
    .table("examAssets")
    .index("by_fileId", (query) => query.eq("fileId", fileId))
    .take(1)
    .pipe(Effect.orDie);
  const clips = yield* reader
    .table("examAudio")
    .index("by_fileId", (query) => query.eq("fileId", fileId))
    .take(1)
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayEmpty(pictures) && Arr.isReadonlyArrayEmpty(clips)) {
    yield* deleteFile(fileId);
  }
});

/**
 * Deletes the images and the audio clips of a deleted exam a page at a time: each file, then its row. A call that
 * fills a page starts the next one, so no call deletes more than `MAX_ASSET_READS` images.
 */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("exams.assets.sweep")(function* ({ examId }) {
    const assets = yield* (yield* DatabaseReader)
      .table("examAssets")
      .index("by_examId", (query) => query.eq("examId", examId))
      .take(MAX_ASSET_READS)
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      assets,
      (asset) =>
        writer
          .table("examAssets")
          .delete(asset._id)
          .pipe(Effect.orDie, Effect.andThen(deleteUnsharedFile(asset.fileId))),
      { discard: true }
    );
    const clips = yield* (yield* DatabaseReader)
      .table("examAudio")
      .index("by_examId", (query) => query.eq("examId", examId))
      .take(MAX_ASSET_READS)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      clips,
      (clip) =>
        writer
          .table("examAudio")
          .delete(clip._id)
          .pipe(Effect.orDie, Effect.andThen(deleteUnsharedFile(clip.fileId))),
      { discard: true }
    );
    if (assets.length < MAX_ASSET_READS && clips.length < MAX_ASSET_READS) {
      return { done: true };
    }
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      examsInternal.assets.sweep,
      { examId }
    );
    return { done: false };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reserve),
  Layer.provide(canAdd),
  Layer.provide(register),
  Layer.provide(registerAudio),
  Layer.provide(commit),
  Layer.provide(commitAudio),
  Layer.provide(media),
  Layer.provide(sweep),
  Layer.provide(urls),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
