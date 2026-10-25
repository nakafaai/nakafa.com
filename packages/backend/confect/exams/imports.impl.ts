import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
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
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { Exam } from "@repo/backend/confect/exams/access";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { figureImages } from "@repo/backend/confect/exams/figures";
import { requireUnfrozen } from "@repo/backend/confect/exams/freeze";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import {
  IMPORT_INSTRUCTIONS,
  ImportedRead,
  ImportPageRefused,
  ImportUnread,
  importedParts,
  keyOf,
} from "@repo/backend/confect/exams/import";
import spec, {
  type ImportSource,
} from "@repo/backend/confect/exams/imports.spec";
import {
  encodeAnswers,
  encodeKey,
  questionAnswers,
} from "@repo/backend/confect/exams/question";
import { answerQuestion } from "@repo/backend/confect/exams/questions/answer";
import { placeQuestion } from "@repo/backend/confect/exams/questions/place";
import { questionOf } from "@repo/backend/confect/exams/questions/read";
import { removeQuestion } from "@repo/backend/confect/exams/questions/remove";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { encodeJsonText } from "@repo/utilities/json";
import { generateText, Output, type UserContent } from "ai";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The bytes at the start of an image that `imageTypeOf` reads. */
const HEAD_BYTES = 16;

/** Answers nothing: the middleware of the function is the check that a teacher may edit the exam. */
const canRead = FunctionImpl.make(
  databaseSchema,
  spec,
  "canRead",
  Effect.fn("exams.imports.canRead")(() => Effect.succeed({}))
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
      const pictures = yield* runQuery(refs.internal.exams.imports.pictures, {
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
          runMutation(refs.internal.exams.imports.discard, {
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
  Effect.fn("exams.imports.read")(
    function* ({ examId, slug, source }) {
      yield* requireAuth();
      const { runQuery } = yield* QueryRunner;
      yield* runQuery(refs.public.exams.imports.canRead, {
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
 * The exam's one question when it is the question the exam was created with and nobody has
 * touched it: its answers and key never saved and its prompt never edited.
 */
const untouchedOnly = (
  order: readonly GenericId.GenericId<"examQuestions">[]
) =>
  Effect.gen(function* () {
    const [only, ...rest] = order;
    if (only === undefined || Arr.isArrayNonEmpty(rest)) {
      return Option.none();
    }
    const reader = yield* DatabaseReader;
    const question = yield* reader
      .table("examQuestions")
      .get(only)
      .pipe(Effect.orDie);
    const prompt = yield* reader
      .table("editorDocuments")
      .get(question.prompt)
      .pipe(Effect.orDie);
    return question.revision === 0 && question.key === null && prompt.head === 0
      ? Option.some(question)
      : Option.none();
  });

/**
 * Places the questions of one read at the end of the exam, in order, each with its figures as
 * images of the exam. A question that is not a choice of two to five options is left out and
 * counted. An exam that holds only the untouched question it was created with loses that
 * question once the first placed question is in, so an import into a new exam starts with the
 * file's first question. A frozen exam, or one the questions would take past its limit, writes
 * nothing.
 */
const place = FunctionImpl.make(
  databaseSchema,
  spec,
  "place",
  Effect.fn("exams.imports.place")(function* ({ questions }) {
    const exam = yield* Exam;
    yield* requireUnfrozen(exam);
    const parts = yield* Effect.map(
      Effect.forEach(questions, (question) =>
        Effect.map(figureImages(exam._id, question.figures), (figures) =>
          Option.map(importedParts(question, figures), (part) => ({
            number: question.number,
            part,
          }))
        )
      ),
      Arr.getSomes
    );
    const blank = yield* untouchedOnly(exam.questions);
    const kept = exam.questions.length - (Option.isSome(blank) ? 1 : 0);
    if (kept + parts.length > MAX_EXAM_QUESTIONS) {
      return yield* new ExamFull();
    }
    const placed = yield* Effect.forEach(parts, ({ number, part }) =>
      Effect.gen(function* () {
        const text = yield* storedDocument(encodeJsonText(part.prompt)).pipe(
          Effect.catchTag("DocumentInvalid", Effect.die)
        );
        const prompt = yield* createDocument({
          scope: exam.scope,
          tenantId: exam.tenantId,
          text,
        });
        return {
          fields: {
            answers: yield* encodeAnswers(part.answers),
            key: part.key === null ? null : yield* encodeKey(part.key),
            prompt,
          },
          keyed: part.key !== null,
          number,
        };
      })
    );
    const order = yield* Effect.reduce(
      placed,
      (): readonly GenericId.GenericId<"examQuestions">[] => exam.questions,
      (current, question) =>
        Effect.map(
          placeQuestion(
            {
              _id: exam._id,
              questions: current,
              scope: exam.scope,
              tenantId: exam.tenantId,
            },
            Option.getOrNull(Arr.last(current)),
            question.fields
          ).pipe(Effect.catchTag("AccessDenied", Effect.die)),
          (questionId) => Arr.append(current, questionId)
        )
    );
    if (Option.isSome(blank) && Arr.isArrayNonEmpty(placed)) {
      yield* removeQuestion(
        { _id: exam._id, questions: order },
        blank.value
      ).pipe(Effect.catchTag("ExamEmpty", Effect.die));
    }
    const ids = Arr.takeRight(order, placed.length);
    return {
      keyless: Arr.length(Arr.filter(placed, (question) => !question.keyed)),
      left: questions.length - parts.length,
      placed: Arr.zipWith(ids, placed, (id, question) => ({
        id,
        number: question.number,
      })),
    };
  })
);

/**
 * Gives each imported question the answer a later key table names. A question that already has
 * a key, or that the teacher has edited since it was placed, keeps what it has, and an answer
 * that names no option of the question is left out. A frozen exam writes nothing.
 */
const keys = FunctionImpl.make(
  databaseSchema,
  spec,
  "keys",
  Effect.fn("exams.imports.keys")(function* ({ keys: entries }) {
    const exam = yield* Exam;
    yield* requireUnfrozen(exam);
    const keyed = yield* Effect.forEach(entries, ({ answer, questionId }) =>
      Effect.gen(function* () {
        const question = yield* questionOf(exam, questionId);
        if (question.key !== null || question.revision !== 0) {
          return false;
        }
        const answers = yield* questionAnswers(question.answers);
        const key = Arr.findFirst(
          answers,
          (
            interaction
          ): interaction is Extract<Interaction, { kind: "choice" }> =>
            interaction.kind === "choice"
        ).pipe(
          Option.flatMap((choice) => Option.fromNullOr(keyOf(choice, answer)))
        );
        if (Option.isNone(key)) {
          return false;
        }
        yield* answerQuestion(question, {
          answers,
          key: key.value,
          revision: question.revision,
        }).pipe(
          Effect.catchTags({
            AnswersDoNotFit: Effect.die,
            DocumentTooLarge: Effect.die,
            KeyDoesNotFit: Effect.die,
            RevisionStale: Effect.die,
          })
        );
        return true;
      })
    );
    return { keyed: Arr.length(Arr.filter(keyed, Boolean)) };
  })
);

/**
 * The stored files of the pictures a Word part names, in its order. A picture of another exam is
 * refused as a missing object, so Nina never sees another school's file.
 */
const pictures = FunctionImpl.make(
  databaseSchema,
  spec,
  "pictures",
  Effect.fn("exams.imports.pictures")(function* ({ assets, examId }) {
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
  Effect.fn("exams.imports.discard")(function* ({ images }) {
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
  Layer.provide(place),
  Layer.provide(keys),
  Layer.provide(pictures),
  Layer.provide(discard),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
