import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { nf } from "@repo/backend/test/editor";
import {
  examImage,
  png,
  questionRows,
  teacherExam,
} from "@repo/backend/test/exams";
import { deployment, provider } from "@repo/backend/test/gateway";
import { storeFile } from "@repo/backend/test/logo";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const { read } = refs.public.exams.reads;

/** What Nina answers for a part: one question with a figure, and the key table of the file's end. */
const NINA_READ = {
  keys: [{ answer: 1, number: 1 }],
  questions: [
    {
      answer: null,
      explanation: "",
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

describe("exams/reads read", () => {
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
        const exam = yield* teacherExam(fixture, "PTS Matematika");
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
        expect(yield* fixture.run(questionRows)).toHaveLength(1);
      })
  );

  it.effect(
    "sends each page's text and image to Nina, then deletes every page image",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const exam = yield* teacherExam(fixture, "PTS Matematika");
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
        const exam = yield* teacherExam(fixture, "PTS Matematika");
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
        const exam = yield* teacherExam(fixture, "PTS Matematika");
        const other = yield* teacherExam(fixture, "PTS Matematika");
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
        const exam = yield* teacherExam(fixture, "PTS Matematika");
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
