import type { GenericId } from "@confect/core";
import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { createDocument } from "@repo/backend/confect/editor/create";
import { placeQuestion } from "@repo/backend/confect/exams/questions/place";
import { currentPrompt } from "@repo/backend/confect/exams/sittings/prompt";
import {
  Array as Arr,
  Clock,
  Effect,
  HashMap,
  Option,
  String as Str,
} from "effect";

/** The most images or clips that a duplicate takes along, far more than an exam of full pages holds. */
const FILE_READS = 1000;

/** The parts of an exam that a duplicate reads. */
type ExamSource = Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">;

/** Each file of the exam with the copy of its row, so a text that names one names the other. */
type FileLinks = readonly (readonly [string, string])[];

/** A text with each file it names turned into that file's copy. */
const relink = (links: FileLinks, text: string) =>
  Arr.reduce(links, text, (current, [from, to]) =>
    Str.replaceAll(from, to)(current)
  );

/**
 * Gives the copy its own row of every image and clip of the exam, on the same stored file. A deleted copy sweeps its
 * rows, and the file stays while another row names it (`exams.assets.sweep`).
 */
const copyFiles = Effect.fn("exams.duplicate.files")(function* (
  source: ExamSource,
  examId: GenericId.GenericId<"exams">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const pictures = yield* reader
    .table("examAssets")
    .index("by_examId", (query) => query.eq("examId", source._id))
    .take(FILE_READS)
    .pipe(Effect.orDie);
  const clips = yield* reader
    .table("examAudio")
    .index("by_examId", (query) => query.eq("examId", source._id))
    .take(FILE_READS)
    .pipe(Effect.orDie);
  const pictureLinks = yield* Effect.forEach(
    pictures,
    ({ _creationTime, _id, ...picture }) =>
      writer
        .table("examAssets")
        .insert({ ...picture, examId })
        .pipe(
          Effect.orDie,
          Effect.map((copy) => [_id, copy] as const)
        )
  );
  const clipLinks = yield* Effect.forEach(
    clips,
    ({ _creationTime, _id, ...clip }) =>
      writer
        .table("examAudio")
        .insert({ ...clip, examId })
        .pipe(
          Effect.orDie,
          Effect.map((copy) => [_id, copy] as const)
        )
  );
  return Arr.appendAll(pictureLinks, clipLinks);
});

/** One text of the exam as a new document of the copy, as it stands now, with no history of its own. */
const copyText = Effect.fn("exams.duplicate.text")(function* (
  source: ExamSource,
  documentId: GenericId.GenericId<"editorDocuments">,
  links: FileLinks
) {
  const text = yield* currentPrompt(documentId);
  return yield* createDocument({
    scope: source.scope,
    tenantId: source.tenantId,
    text: relink(links, text),
  });
});

/** Each reading of the exam with its copy, so the questions that share one go on sharing it. */
type Readings = HashMap.HashMap<string, GenericId.GenericId<"editorDocuments">>;

/** The copy of a question's reading, which the first question that holds it makes. */
const copyReading = Effect.fn("exams.duplicate.reading")(function* (
  source: ExamSource,
  question: ExamQuestionsDoc,
  links: FileLinks,
  readings: Readings
) {
  if (question.reading === undefined) {
    return Option.none();
  }
  const held = HashMap.get(readings, question.reading);
  return Option.some(
    Option.isSome(held)
      ? held.value
      : yield* copyText(source, question.reading, links)
  );
});

/**
 * Copies an exam for a new use, with what its questions say now, each in a new document, and no sitting, room or
 * result, so a teacher can edit it however the exam it came from is locked. The copy stands in the same scope.
 */
export const duplicateExam = Effect.fn("exams.exam.duplicate")(function* (
  source: ExamSource,
  title: string
) {
  const { appUser } = yield* requireAuth().pipe(Effect.orDie);
  const at = yield* Clock.currentTimeMillis;
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const examId = yield* writer
    .table("exams")
    .insert({
      createdAt: at,
      createdBy: appUser._id,
      questions: [],
      scope: source.scope,
      tenantId: source.tenantId,
      title,
    })
    .pipe(Effect.orDie);
  const links = yield* copyFiles(source, examId);
  const start = () => ({
    order: Arr.empty<GenericId.GenericId<"examQuestions">>(),
    readings: HashMap.empty<string, GenericId.GenericId<"editorDocuments">>(),
  });
  yield* Effect.reduce(source.questions, start, ({ order, readings }, id) =>
    Effect.gen(function* () {
      const question = yield* reader
        .table("examQuestions")
        .get(id)
        .pipe(Effect.orDie);
      const reading = yield* copyReading(source, question, links, readings);
      const copied = yield* placeQuestion(
        {
          _id: examId,
          questions: order,
          scope: source.scope,
          tenantId: source.tenantId,
        },
        Option.getOrNull(Arr.last(order)),
        {
          answers: relink(links, question.answers),
          explanation: yield* copyText(source, question.explanation, links),
          key: question.key,
          ...(question.media === undefined
            ? {}
            : { media: relink(links, question.media) }),
          points: question.points,
          prompt: yield* copyText(source, question.prompt, links),
          ...Option.match(reading, {
            onNone: () => ({}),
            onSome: (held) => ({ reading: held }),
          }),
          rubric: yield* copyText(source, question.rubric, links),
          ...(question.scoring === undefined
            ? {}
            : { scoring: question.scoring }),
          template: question.template,
        }
      );
      return {
        order: Arr.append(order, copied),
        readings:
          question.reading !== undefined && Option.isSome(reading)
            ? HashMap.set(readings, question.reading, reading.value)
            : readings,
      };
    })
  );
  return examId;
});
