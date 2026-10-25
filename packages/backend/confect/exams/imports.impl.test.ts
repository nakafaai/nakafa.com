import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { encodeKey } from "@repo/backend/confect/exams/question";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { nf } from "@repo/backend/test/editor";
import { deployment, provider } from "@repo/backend/test/gateway";
import { storeFile } from "@repo/backend/test/logo";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Option } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const { create } = refs.public.exams.exams;
const { register } = refs.public.exams.assets;
const { keys, place, read } = refs.public.exams.imports;

/** The leading bytes of a PNG file, which the server reads as an image. */
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** An image of a few bytes, which the server accepts as a PNG. */
const png = () =>
  new Blob([Uint8Array.from([...PNG_HEAD, 0, 0, 0, 0])], { type: "image/png" });

/** What Nina answers for a part: one question with a figure, and the key table of the file's end. */
const NINA_READ = {
  keys: [{ answer: 1, number: 1 }],
  questions: [
    {
      answer: null,
      figures: [
        {
          alt: "Segitiga",
          box: { bottom: 400, left: 100, right: 500, top: 100 },
          image: null,
          page: 1,
        },
      ],
      number: 1,
      options: ["4", "5"],
      prompt: "Berapa 2 + 3?\n{{figure:1}}",
    },
  ],
};

/** A language model that answers every read with `output`, written as Nina writes JSON. */
const ninaAnswers = (output: unknown) => {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([{ text: encodeJsonText(output), type: "text" }]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
};

/** The fixture of one test: two schools with their people. */
type Fixture = Effect.Success<typeof tenancyFixture>;

/** A new exam of the teacher's unit, which holds the one untouched question it is created with. */
const newExam = (fixture: Fixture) =>
  fixture.as("teacher").mutation(create, {
    scope: { kind: "unit", unitId: fixture.units.smp },
    slug: nf,
    title: "PTS Matematika",
  });

/** An image of an exam, registered by the teacher. */
const examImage = (fixture: Fixture, examId: GenericId.GenericId<"exams">) =>
  Effect.flatMap(storeFile(fixture.convex, png()), (storageId) =>
    fixture
      .as("teacher")
      .action(register, { examId, height: 30, slug: nf, storageId, width: 40 })
  );

/** The exam's questions in its order. */
const questionsOf = (examId: GenericId.GenericId<"exams">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const exam = yield* reader.table("exams").get(examId).pipe(Effect.orDie);
    return yield* Effect.forEach(exam.questions, (id) =>
      reader.table("examQuestions").get(id).pipe(Effect.orDie)
    );
  });

/** The exam's first question. */
const firstOf = (examId: GenericId.GenericId<"exams">) =>
  Effect.map(questionsOf(examId), (questions) =>
    Option.getOrThrow(Arr.head(questions))
  );

/** The stored text of a document's snapshot. */
const snapshotOf = (documentId: GenericId.GenericId<"editorDocuments">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("editorSnapshots")
      .index("by_documentId", (query) => query.eq("documentId", documentId))
      .first()
      .pipe(
        Effect.orDie,
        Effect.map((row) => Option.getOrThrow(row).content)
      )
  );

/** Whether storage still holds a file. */
const storedFile = (
  fixture: Fixture,
  storageId: GenericId.GenericId<"_storage">
) =>
  Effect.promise(() =>
    fixture.convex.run(
      async (ctx) => (await ctx.storage.get(storageId)) !== null
    )
  );

/** Freezes an exam, as its first scheduled sitting does. */
const freeze = (examId: GenericId.GenericId<"exams">) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("exams")
      .patch(examId, { frozenAt: TENANCY_NOW })
      .pipe(Effect.orDie)
  );

/** Fills an exam's order to its limit with one question, as two hundred placements would. */
const fill = (
  examId: GenericId.GenericId<"exams">,
  questionId: GenericId.GenericId<"examQuestions">
) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("exams")
      .patch(examId, { questions: Arr.makeBy(200, () => questionId) })
      .pipe(Effect.orDie)
  );

/** Marks a question as edited by the teacher, which counts its revision up. */
const touch = (questionId: GenericId.GenericId<"examQuestions">) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("examQuestions")
      .patch(questionId, { revision: 1 })
      .pipe(Effect.orDie)
  );

/** A question to place: two options, with the given answer and figures. */
const toPlace = (
  prompt: string,
  answer: number | null,
  figures: readonly {
    readonly alt: string;
    readonly asset: GenericId.GenericId<"examAssets">;
  }[] = []
) => ({ answer, figures, number: null, options: ["A", "B"], prompt });

describe("exams/imports read", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  afterEach(() => {
    provider.languageModel.mockReset();
    deployment.mockReset();
    deployment.mockReturnValue(Effect.void);
  });

  it.effect(
    "answers Nina's questions, figures and key table for a Word part with its pictures, and places nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const picture = yield* examImage(fixture, exam.id);
        const model = ninaAnswers(NINA_READ);
        const answer = yield* fixture.as("teacher").action(read, {
          examId: exam.id,
          slug: nf,
          source: {
            images: [picture.id],
            kind: "text",
            text: "1. Berapa 2 + 3? [image 1]",
          },
        });
        expect(answer).toEqual(NINA_READ);
        expect(model.doGenerateCalls[0]?.prompt[0]).toMatchObject({
          role: "system",
        });
        expect(model.doGenerateCalls[0]?.prompt[1]?.content).toEqual([
          { text: "1. Berapa 2 + 3? [image 1]", type: "text" },
          { text: "Image 1:", type: "text" },
          expect.objectContaining({ mediaType: "image/png", type: "file" }),
        ]);
        expect(yield* fixture.run(questionsOf(exam.id))).toHaveLength(1);
      })
  );

  it.effect(
    "sends each page's text and image to Nina, then deletes every page image",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const model = ninaAnswers({ keys: [], questions: [] });
        const image = yield* storeFile(fixture.convex, png());
        yield* fixture.as("teacher").action(read, {
          examId: exam.id,
          slug: nf,
          source: { kind: "pages", pages: [{ image, text: "Halaman satu" }] },
        });
        expect(model.doGenerateCalls[0]?.prompt[1]?.content).toEqual([
          { text: "Page 1:\nHalaman satu", type: "text" },
          expect.objectContaining({ mediaType: "image/png", type: "file" }),
        ]);
        expect(yield* storedFile(fixture, image)).toBe(false);
      })
  );

  it.effect(
    "refuses a page that is no image, or over the image limit, without calling Nina, and deletes every page image",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const model = ninaAnswers(NINA_READ);
        const pdf = yield* storeFile(
          fixture.convex,
          new Blob(["%PDF-1.7 not an image"], { type: "image/png" })
        );
        const huge = yield* storeFile(
          fixture.convex,
          new Blob([new Uint8Array(IMAGE_BYTE_LIMIT + 1)], {
            type: "image/png",
          })
        );
        const refusals = yield* Effect.forEach([pdf, huge], (image) =>
          fixture
            .as("teacher")
            .action(read, {
              examId: exam.id,
              slug: nf,
              source: { kind: "pages", pages: [{ image, text: "" }] },
            })
            .pipe(Effect.flip)
        );
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual([
          "ImportPageRefused",
          "ImportPageRefused",
        ]);
        expect(model.doGenerateCalls).toHaveLength(0);
        expect(yield* storedFile(fixture, pdf)).toBe(false);
        expect(yield* storedFile(fixture, huge)).toBe(false);
      })
  );

  it.effect(
    "refuses a member who may not edit the exam, and a picture of another exam, before any model call",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const other = yield* newExam(fixture);
        const foreign = yield* examImage(fixture, other.id);
        const model = ninaAnswers(NINA_READ);
        const text = { images: [], kind: "text" as const, text: "Soal" };
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .action(read, { examId: exam.id, slug: nf, source: text })
            .pipe(Effect.flip),
          fixture
            .as("stranger")
            .action(read, { examId: exam.id, slug: nf, source: text })
            .pipe(Effect.flip),
          fixture
            .as("teacher")
            .action(read, {
              examId: exam.id,
              slug: nf,
              source: { images: [foreign.id], kind: "text", text: "Soal" },
            })
            .pipe(Effect.flip),
        ]);
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual([
          "AccessDenied",
          "AccessDenied",
          "AccessDenied",
        ]);
        expect(model.doGenerateCalls).toHaveLength(0);
      })
  );

  it.effect(
    "answers ImportUnread when Nina fails, answers out of shape, or the deployment has no gateway",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const send = fixture
          .as("teacher")
          .action(read, {
            examId: exam.id,
            slug: nf,
            source: { images: [], kind: "text", text: "Soal" },
          })
          .pipe(Effect.flip);
        ninaAnswers({ questions: "none" });
        const shape = yield* send;
        provider.languageModel.mockReturnValue(
          new MockLanguageModelV4({
            doGenerate: () => Promise.reject(new Error("Provider failed")),
          })
        );
        const failed = yield* send;
        deployment.mockReturnValue(
          Effect.fail(new GatewayConfigurationError({ message: "No gateway." }))
        );
        const unavailable = yield* send;
        expect(
          Arr.map([shape, failed, unavailable], (error) => error._tag)
        ).toEqual(["ImportUnread", "ImportUnread", "ImportUnread"]);
      })
  );
});

describe("exams/imports place and keys", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "places questions at the end of a new exam in order, with their keys and formulas, in place of the untouched first question",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const placed = yield* fixture.as("teacher").mutation(place, {
          examId: exam.id,
          questions: [
            { ...toPlace("Berapa \\(2 + 3\\)?", 1), number: 1 },
            toPlace("Ibu kota Indonesia?", null),
            { ...toPlace("Jelaskan.", null), options: [] },
          ],
          slug: nf,
        });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(placed).toEqual({
          keyless: 1,
          left: 1,
          placed: Arr.map(questions, (question, index) => ({
            id: question._id,
            number: index === 0 ? 1 : null,
          })),
        });
        expect(Arr.map(questions, (question) => question.key)).toEqual([
          yield* encodeKey([
            { correct: ["option-2"], interaction: "choice", kind: "choice" },
          ]),
          null,
        ]);
        const first = yield* fixture.run(firstOf(exam.id));
        expect(yield* fixture.run(snapshotOf(first.prompt))).toContain(
          '"type":"mathInline"'
        );
      })
  );

  it.effect(
    "keeps a first question the teacher touched, and places nothing for a read without a question",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const teacher = fixture.as("teacher");
        const empty = yield* teacher.mutation(place, {
          examId: exam.id,
          questions: [],
          slug: nf,
        });
        expect(empty).toEqual({ keyless: 0, left: 0, placed: [] });
        const first = yield* fixture.run(firstOf(exam.id));
        yield* fixture.run(touch(first._id));
        yield* teacher.mutation(place, {
          examId: exam.id,
          questions: [toPlace("Soal", 0)],
          slug: nf,
        });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(Arr.map(questions, (question) => question._id)).toHaveLength(2);
        expect(yield* fixture.run(firstOf(exam.id))).toMatchObject({
          _id: first._id,
        });
      })
  );

  it.effect(
    "refuses a figure of another exam, a student, a full exam and a frozen one, writing nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const other = yield* newExam(fixture);
        const foreign = yield* examImage(fixture, other.id);
        const send = (
          account: "student" | "teacher",
          questions: readonly ReturnType<typeof toPlace>[]
        ) =>
          fixture
            .as(account)
            .mutation(place, { examId: exam.id, questions, slug: nf })
            .pipe(Effect.flip);
        const figure = yield* send("teacher", [
          toPlace("{{figure:1}}", 0, [{ alt: "Gambar", asset: foreign.id }]),
        ]);
        const student = yield* send("student", [toPlace("Soal", 0)]);
        const first = yield* fixture.run(firstOf(exam.id));
        yield* fixture.run(fill(exam.id, first._id));
        const full = yield* send("teacher", [toPlace("Soal", 0)]);
        yield* fixture.run(freeze(exam.id));
        const frozen = yield* send("teacher", [toPlace("Soal", 0)]);
        expect(
          Arr.map([figure, student, full, frozen], (error) => error._tag)
        ).toEqual(["AccessDenied", "AccessDenied", "ExamFull", "ExamFrozen"]);
      })
  );

  it.effect(
    "gives each placed question without a key the answer a later key table names, and leaves the others as they are",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const teacher = fixture.as("teacher");
        const placed = yield* teacher.mutation(place, {
          examId: exam.id,
          questions: [
            toPlace("Satu", null),
            toPlace("Dua", 0),
            toPlace("Tiga", null),
            toPlace("Empat", null),
          ],
          slug: nf,
        });
        const ids = Arr.map(placed.placed, (question) => question.id);
        const idAt = (index: number) => Option.getOrThrow(Arr.get(ids, index));
        yield* fixture.run(touch(idAt(3)));
        const keyed = yield* teacher.mutation(keys, {
          examId: exam.id,
          keys: [
            { answer: 1, questionId: idAt(0) },
            { answer: 1, questionId: idAt(1) },
            { answer: 7, questionId: idAt(2) },
            { answer: 0, questionId: idAt(3) },
          ],
          slug: nf,
        });
        expect(keyed).toEqual({ keyed: 1 });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(Arr.map(questions, (question) => question.key)).toEqual([
          yield* encodeKey([
            { correct: ["option-2"], interaction: "choice", kind: "choice" },
          ]),
          yield* encodeKey([
            { correct: ["option-1"], interaction: "choice", kind: "choice" },
          ]),
          null,
          null,
        ]);
        const other = yield* newExam(fixture);
        const foreign = yield* teacher
          .mutation(keys, {
            examId: other.id,
            keys: [{ answer: 0, questionId: idAt(2) }],
            slug: nf,
          })
          .pipe(Effect.flip);
        yield* fixture.run(freeze(exam.id));
        const frozen = yield* teacher
          .mutation(keys, { examId: exam.id, keys: [], slug: nf })
          .pipe(Effect.flip);
        expect([foreign._tag, frozen._tag]).toEqual([
          "AccessDenied",
          "ExamFrozen",
        ]);
      })
  );
});
