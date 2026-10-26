import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import {
  IMPORT_INSTRUCTIONS,
  ImportedRead,
  ImportPageRefused,
  ImportUnread,
} from "@repo/backend/confect/exams/import";
import spec, {
  type ImportSource,
} from "@repo/backend/confect/exams/reads.spec";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/upload";
import { generateText, Output, type UserContent } from "ai";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The bytes at the start of an image that `imageTypeOf` reads. */
const HEAD_BYTES = 16;

/** Answers nothing: the middleware of the function is the check that a teacher may edit the exam. */
const canRead = FunctionImpl.make(
  databaseSchema,
  spec,
  "canRead",
  Effect.fn("exams.reads.canRead")(() => Effect.succeed({}))
);

/**
 * The bytes and the type of one stored image. An image over the size limit, or one whose
 * leading bytes name no image, is refused before Nina sees it.
 */
const storedImage = (storageId: GenericId.GenericId<"_storage">) =>
  Effect.gen(function* () {
    const { runQuery } = yield* QueryRunner;
    const { size } = yield* runQuery(refs.internal.exams.assets.stored, {
      storageId,
    }).pipe(Effect.orDie);
    if (size > IMAGE_BYTE_LIMIT) {
      return yield* new ImportPageRefused();
    }
    const blob = yield* (yield* StorageActionWriter)
      .get(storageId)
      .pipe(Effect.orDie);
    const data = new Uint8Array(
      yield* Effect.promise(() => blob.arrayBuffer())
    );
    const mediaType = yield* Effect.fromOption(
      imageTypeOf(data.slice(0, HEAD_BYTES))
    ).pipe(Effect.mapError(() => new ImportPageRefused()));
    return { data, mediaType, type: "file" as const };
  });

/**
 * What one read hands Nina. A PDF part is each page's text layer before its image; its page
 * images are deleted once they are read or refused, so no page of a teacher's file stays in
 * storage. A Word part is its text, then each of its pictures, which are images of this exam.
 */
const sourceContent = (
  examId: GenericId.GenericId<"exams">,
  source: typeof ImportSource.Type
) =>
  Effect.gen(function* () {
    if (source.kind === "text") {
      const { runQuery } = yield* QueryRunner;
      const pictures = yield* runQuery(refs.internal.exams.reads.pictures, {
        assets: Arr.fromIterable(source.images),
        examId,
      });
      const images = yield* Effect.forEach(pictures, (picture, index) =>
        Effect.map(storedImage(picture.storageId), (image) => [
          { text: `Image ${index + 1}:`, type: "text" as const },
          image,
        ])
      );
      return [
        { text: source.text, type: "text" as const },
        ...Arr.flatten(images),
      ] satisfies UserContent;
    }
    const pages = yield* Effect.forEach(source.pages, (page, index) =>
      Effect.map(storedImage(page.image), (image) => [
        { text: `Page ${index + 1}:\n${page.text}`, type: "text" as const },
        image,
      ])
    ).pipe(
      Effect.ensuring(
        Effect.flatMap(MutationRunner, ({ runMutation }) =>
          runMutation(refs.internal.exams.reads.discard, {
            images: Arr.map(source.pages, (page) => page.image),
          })
        ).pipe(Effect.orDie)
      )
    );
    return Arr.flatten(pages) satisfies UserContent;
  });

/**
 * Nina's read of one part: its questions, their figures, and any answer key table. Any failure
 * of the model or of that shape is `ImportUnread`, so nothing is placed and the part can be sent
 * again.
 */
const readPart = (content: UserContent) =>
  Effect.gen(function* () {
    const reader = (yield* Gateway).language("import");
    const { output } = yield* Effect.tryPromise({
      try: (signal) =>
        generateText({
          abortSignal: signal,
          messages: [{ content, role: "user" }],
          model: reader.model,
          output: Output.object({ schema: createEffectSchema(ImportedRead) }),
          system: IMPORT_INSTRUCTIONS,
          timeout: reader.timeout,
        }),
      catch: () => new ImportUnread(),
    });
    return output;
  }).pipe(
    Effect.provide(GatewayLive),
    Effect.catchTag("GatewayConfigurationError", () =>
      Effect.fail(new ImportUnread())
    )
  );

/**
 * Reads one part of a teacher's file with Nina. The teacher's right to edit the exam is checked
 * before any image is read or any model is called. Nothing is placed: the browser cuts the
 * figures from the pages it holds and places the questions next.
 */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("exams.reads.read")(
    function* ({ examId, slug, source }) {
      yield* requireAuth();
      const { runQuery } = yield* QueryRunner;
      yield* runQuery(refs.public.exams.reads.canRead, {
        examId,
        slug,
      }).pipe(
        Effect.catchTag("NotMember", () =>
          Effect.fail(new AccessDenied({ action: "exam.edit", reason: "role" }))
        )
      );
      return yield* readPart(yield* sourceContent(examId, source));
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * The stored files of the pictures a Word part names, in its order. A picture of another exam is
 * refused as a missing object, so Nina never sees another school's file.
 */
const pictures = FunctionImpl.make(
  databaseSchema,
  spec,
  "pictures",
  Effect.fn("exams.reads.pictures")(function* ({ assets, examId }) {
    const reader = yield* DatabaseReader;
    return yield* Effect.forEach(assets, (assetId) =>
      Effect.gen(function* () {
        const asset = yield* reader
          .table("examAssets")
          .get(assetId)
          .pipe(Effect.option);
        if (Option.isNone(asset) || asset.value.examId !== examId) {
          return yield* new AccessDenied({
            action: "exam.edit",
            reason: "resource",
          });
        }
        return { storageId: asset.value.storageId };
      })
    );
  })
);

/** Deletes the page images of a read, whether Nina read them or the read was refused. */
const discard = FunctionImpl.make(
  databaseSchema,
  spec,
  "discard",
  Effect.fn("exams.reads.discard")(function* ({ images }) {
    const storage = yield* StorageWriter;
    yield* Effect.forEach(images, (storageId) =>
      storage.delete(storageId).pipe(Effect.orDie)
    );
    return {};
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(canRead),
  Layer.provide(read),
  Layer.provide(pictures),
  Layer.provide(discard),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
