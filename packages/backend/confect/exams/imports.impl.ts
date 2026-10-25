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
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { requireUnfrozen } from "@repo/backend/confect/exams/freeze";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import {
  IMPORT_INSTRUCTIONS,
  ImportedRead,
  ImportPageRefused,
  ImportUnread,
  importedParts,
} from "@repo/backend/confect/exams/import";
import spec, {
  type ImportSource,
} from "@repo/backend/confect/exams/imports.spec";
import { encodeAnswers, encodeKey } from "@repo/backend/confect/exams/question";
import { placeQuestion } from "@repo/backend/confect/exams/questions/place";
import { removeQuestion } from "@repo/backend/confect/exams/questions/remove";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { encodeJsonText } from "@repo/utilities/json";
import { generateText, Output, type UserContent } from "ai";
import { Array as Arr, Effect, Layer, Option, Result } from "effect";

/** The bytes at the start of a page image that `imageTypeOf` reads. */
const HEAD_BYTES = 16;

/** Answers nothing: the middleware of the function is the check that a teacher may edit the exam. */
const canRead = FunctionImpl.make(
  databaseSchema,
  spec,
  "canRead",
  Effect.fn("exams.imports.canRead")(() => Effect.succeed({}))
);

/**
 * What one read hands Nina: the text of a Word file, or each page's text layer before its
 * image. A page image over the size limit, or one whose leading bytes name no image, refuses
 * the whole read. The page images are deleted once they are read or refused, so no page of a
 * teacher's file stays in storage.
 */
const sourceContent = (source: typeof ImportSource.Type) =>
  Effect.gen(function* () {
    if (source.kind === "text") {
      return [{ text: source.text, type: "text" }] satisfies UserContent;
    }
    const { runQuery } = yield* QueryRunner;
    const storage = yield* StorageActionWriter;
    const pages = yield* Effect.forEach(source.pages, (page, index) =>
      Effect.gen(function* () {
        const { size } = yield* runQuery(refs.internal.exams.assets.stored, {
          storageId: page.image,
        }).pipe(Effect.orDie);
        if (size > IMAGE_BYTE_LIMIT) {
          return yield* new ImportPageRefused();
        }
        const blob = yield* storage.get(page.image).pipe(Effect.orDie);
        const bytes = new Uint8Array(
          yield* Effect.promise(() => blob.arrayBuffer())
        );
        const mediaType = yield* Effect.fromOption(
          imageTypeOf(bytes.slice(0, HEAD_BYTES))
        ).pipe(Effect.mapError(() => new ImportPageRefused()));
        return [
          { text: `Page ${index + 1}:\n${page.text}`, type: "text" as const },
          { data: bytes, mediaType, type: "file" as const },
        ];
      })
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
 * Nina's questions for one read. The model writes them in the shape of `ImportedRead`, and any
 * failure of the model or of that shape is `ImportUnread`, so nothing is placed and the read can
 * be sent again.
 */
const readQuestions = (content: UserContent) =>
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
    return output.questions;
  }).pipe(
    Effect.provide(GatewayLive),
    Effect.catchTag("GatewayConfigurationError", () =>
      Effect.fail(new ImportUnread())
    )
  );

/**
 * Reads one part of a teacher's file and places its questions at the end of the exam. The
 * teacher's right to edit the exam is checked before any page is read or any model is called.
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
      const questions = yield* readQuestions(yield* sourceContent(source));
      const { runMutation } = yield* MutationRunner;
      return yield* runMutation(refs.internal.exams.imports.place, {
        examId,
        questions,
      });
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * Places the questions of one read at the end of the exam, in order. A question that is not a
 * choice of two to five options is left out and counted. An exam that holds only the untouched
 * question it was created with loses that question, so an import into a new exam starts with the
 * file's first question. A frozen exam, or one the questions would take past its limit, writes
 * nothing.
 */
const place = FunctionImpl.make(
  databaseSchema,
  spec,
  "place",
  Effect.fn("exams.imports.place")(function* ({ examId, questions }) {
    const reader = yield* DatabaseReader;
    const exam = yield* reader.table("exams").get(examId).pipe(Effect.orDie);
    yield* requireUnfrozen(exam);
    const parts = Arr.filterMap(questions, (question) =>
      Result.fromOption(importedParts(question), () => question)
    );
    const blank = yield* untouchedOnly(exam.questions);
    const kept = exam.questions.length - (Option.isSome(blank) ? 1 : 0);
    if (kept + parts.length > MAX_EXAM_QUESTIONS) {
      return yield* new ExamFull();
    }
    const order = yield* Effect.reduce(
      parts,
      (): readonly GenericId.GenericId<"examQuestions">[] => exam.questions,
      (current, part) =>
        Effect.gen(function* () {
          const text = yield* storedDocument(encodeJsonText(part.prompt)).pipe(
            Effect.catchTag("DocumentInvalid", Effect.die)
          );
          const prompt = yield* createDocument({
            scope: exam.scope,
            tenantId: exam.tenantId,
            text,
          });
          const questionId = yield* placeQuestion(
            {
              _id: exam._id,
              questions: current,
              scope: exam.scope,
              tenantId: exam.tenantId,
            },
            Option.getOrNull(Arr.last(current)),
            {
              answers: yield* encodeAnswers(part.answers),
              key: part.key === null ? null : yield* encodeKey(part.key),
              prompt,
            }
          ).pipe(Effect.catchTag("AccessDenied", Effect.die));
          return Arr.append(current, questionId);
        })
    );
    yield* Option.match(blank, {
      onNone: () => Effect.void,
      onSome: (question) =>
        parts.length === 0
          ? Effect.void
          : removeQuestion({ _id: exam._id, questions: order }, question).pipe(
              Effect.catchTag("ExamEmpty", Effect.die)
            ),
    });
    return {
      keyless: Arr.length(Arr.filter(parts, (part) => part.key === null)),
      left: questions.length - parts.length,
      placed: parts.length,
    };
  })
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
  Layer.provide(discard),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
