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
const { read } = refs.public.exams.imports;

/** The leading bytes of a PNG file, which the server reads as an image. */
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A page image of a few bytes, which the server accepts as a PNG. */
const pagePng = () =>
  new Blob([Uint8Array.from([...PNG_HEAD, 0, 0, 0, 0])], { type: "image/png" });

/** Three questions as Nina reads them: one keyed, one without a key, and one that is no choice. */
const NINA_READ = {
  questions: [
    { answer: 1, options: ["4", "5", "6", "7"], prompt: "Berapa 2 + 3?" },
    {
      answer: null,
      options: ["\\(x^2\\)", "\\(2x\\)"],
      prompt: "Turunan dari \\(x^2\\) adalah",
    },
    { answer: null, options: [], prompt: "Jelaskan fotosintesis." },
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

/** A new exam of the teacher's unit, which holds the one untouched question it is created with. */
const newExam = Effect.fn("test.imports.newExam")(function* (
  fixture: Effect.Success<typeof tenancyFixture>
) {
  return yield* fixture.as("teacher").mutation(create, {
    scope: { kind: "unit", unitId: fixture.units.smp },
    slug: nf,
    title: "PTS Matematika",
  });
});

/** The exam's questions in its order, with their keys as the rows store them. */
const questionsOf = (examId: GenericId.GenericId<"exams">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const exam = yield* reader.table("exams").get(examId).pipe(Effect.orDie);
    return yield* Effect.forEach(exam.questions, (id) =>
      reader.table("examQuestions").get(id).pipe(Effect.orDie)
    );
  });

/** Whether storage still holds a file. */
const storedFile = (
  fixture: Effect.Success<typeof tenancyFixture>,
  storageId: GenericId.GenericId<"_storage">
) =>
  Effect.promise(() =>
    fixture.convex.run(
      async (ctx) => (await ctx.storage.get(storageId)) !== null
    )
  );

/** The question a new exam is created with. */
const firstQuestion = (examId: GenericId.GenericId<"exams">) =>
  Effect.map(questionsOf(examId), (questions) =>
    Option.getOrThrow(Arr.head(questions))
  );

describe("exams/imports", () => {
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
    "places the questions of a Word file at the end of a new exam in order, with their keys, in place of the untouched first question",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const model = ninaAnswers(NINA_READ);
        const placed = yield* fixture.as("teacher").action(read, {
          examId: exam.id,
          slug: nf,
          source: { kind: "text", text: "1. Berapa 2 + 3? A. 4 B. 5" },
        });
        expect(placed).toEqual({ keyless: 1, left: 1, placed: 2 });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(Arr.map(questions, (question) => question.key)).toEqual([
          yield* encodeKey([
            { correct: ["option-2"], interaction: "choice", kind: "choice" },
          ]),
          null,
        ]);
        const [call] = model.doGenerateCalls;
        expect(call?.prompt[0]).toMatchObject({ role: "system" });
        expect(call?.prompt[1]).toMatchObject({
          content: [{ text: "1. Berapa 2 + 3? A. 4 B. 5", type: "text" }],
          role: "user",
        });
      })
  );

  it.effect(
    "keeps a first question the teacher has touched, and places the read after it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const first = yield* fixture.run(firstQuestion(exam.id));
        // An edit of the answers counts the question's revision up.
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("examQuestions")
              .patch(first._id, { revision: 1 })
              .pipe(Effect.orDie)
          )
        );
        ninaAnswers(NINA_READ);
        yield* fixture.as("teacher").action(read, {
          examId: exam.id,
          slug: nf,
          source: { kind: "text", text: "Soal" },
        });
        const questions = yield* fixture.run(questionsOf(exam.id));
        expect(Arr.head(questions)).toEqual(
          Option.some(expect.objectContaining({ _id: first._id }))
        );
        expect(questions).toHaveLength(3);
      })
  );

  it.effect(
    "sends each page's text and image to Nina, then deletes every page image",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const model = ninaAnswers({ questions: [] });
        const image = yield* storeFile(fixture.convex, pagePng());
        const placed = yield* fixture.as("teacher").action(read, {
          examId: exam.id,
          slug: nf,
          source: { kind: "pages", pages: [{ image, text: "Halaman satu" }] },
        });
        expect(placed).toEqual({ keyless: 0, left: 0, placed: 0 });
        expect(model.doGenerateCalls[0]?.prompt[1]?.content).toEqual([
          { text: "Page 1:\nHalaman satu", type: "text" },
          expect.objectContaining({ mediaType: "image/png", type: "file" }),
        ]);
        expect(yield* storedFile(fixture, image)).toBe(false);
        expect(yield* fixture.run(questionsOf(exam.id))).toHaveLength(1);
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
    "refuses a member who may not edit the exam before any model call",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const model = ninaAnswers(NINA_READ);
        const refused = yield* fixture
          .as("student")
          .action(read, {
            examId: exam.id,
            slug: nf,
            source: { kind: "text", text: "Soal" },
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
        const outsider = yield* fixture
          .as("stranger")
          .action(read, {
            examId: exam.id,
            slug: nf,
            source: { kind: "text", text: "Soal" },
          })
          .pipe(Effect.flip);
        expect(outsider).toMatchObject({ _tag: "AccessDenied" });
        expect(model.doGenerateCalls).toHaveLength(0);
      })
  );

  it.effect(
    "answers ImportUnread and places nothing when Nina fails, answers out of shape, or the deployment has no gateway",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const teacher = fixture.as("teacher");
        const send = teacher
          .action(read, {
            examId: exam.id,
            slug: nf,
            source: { kind: "text", text: "Soal" },
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
        expect(yield* fixture.run(questionsOf(exam.id))).toHaveLength(1);
      })
  );

  it.effect(
    "refuses a frozen exam and one the read would take past its limit, writing nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* newExam(fixture);
        const first = yield* fixture.run(firstQuestion(exam.id));
        const teacher = fixture.as("teacher");
        const send = teacher
          .action(read, {
            examId: exam.id,
            slug: nf,
            source: { kind: "text", text: "Soal" },
          })
          .pipe(Effect.flip);
        ninaAnswers(NINA_READ);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("exams")
              .patch(exam.id, {
                questions: Arr.makeBy(199, () => first._id),
              })
              .pipe(Effect.orDie)
          )
        );
        const full = yield* send;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("exams")
              .patch(exam.id, { frozenAt: TENANCY_NOW })
              .pipe(Effect.orDie)
          )
        );
        const frozen = yield* send;
        expect([full._tag, frozen._tag]).toEqual(["ExamFull", "ExamFrozen"]);
      })
  );
});
