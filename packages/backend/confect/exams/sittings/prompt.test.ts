import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { EMPTY_PROMPT_TEXT } from "@repo/backend/confect/exams/question";
import {
  insertStep,
  nf,
  paragraphText,
  plantStep,
} from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { lock, paper, prompt } = refs.public.exams.sittings;

/** The prompt of one question of a student's paper, read on one device. */
const promptOf = (
  fixture: SittingFixture,
  args: {
    deviceId: string;
    questionId: GenericId.GenericId<"examQuestions">;
    sittingId: GenericId.GenericId<"examSittings">;
  }
) => fixture.as("student").query(prompt, { ...args, slug: nf });

/** The first question of a student's paper, which the test reads for its ID. */
const firstQuestion = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture
    .as("student")
    .query(paper, { deviceId: deviceOf(1), sittingId, slug: nf })
    .pipe(Effect.map((view) => view.questions[0].id));

/** The prompt document of a question, which the editor keeps. */
const promptDocumentOf = (
  fixture: SittingFixture,
  questionId: GenericId.GenericId<"examQuestions">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("examQuestions")
        .get(questionId)
        .pipe(
          Effect.map((question) => question.prompt),
          Effect.orDie
        )
    )
  );

describe("exams/sittings prompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives the bound student the question's prompt as the editor stores it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const questionId = yield* firstQuestion(fixture, made.id);
        const reply = yield* promptOf(fixture, {
          deviceId: deviceOf(1),
          questionId,
          sittingId: made.id,
        });
        expect(reply).toEqual({
          prompt: yield* storedDocument(EMPTY_PROMPT_TEXT).pipe(Effect.orDie),
        });
      })
  );

  it.effect(
    "shows the teacher's last edit, which the steps after the snapshot hold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const questionId = yield* firstQuestion(fixture, made.id);
        const document = yield* promptDocumentOf(fixture, questionId);
        yield* plantStep(fixture, document, insertStep("Edited"));
        const reply = yield* promptOf(fixture, {
          deviceId: deviceOf(1),
          questionId,
          sittingId: made.id,
        });
        expect(reply).toEqual({
          prompt: yield* storedDocument(paragraphText("Edited")).pipe(
            Effect.orDie
          ),
        });
      })
  );

  it.effect(
    "refuses steps that do not reach the head, rather than showing older text",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const questionId = yield* firstQuestion(fixture, made.id);
        const document = yield* promptDocumentOf(fixture, questionId);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("editorDocuments")
              .patch(document, { head: 300 })
              .pipe(Effect.orDie)
          )
        );
        const failure = yield* promptOf(fixture, {
          deviceId: deviceOf(1),
          questionId,
          sittingId: made.id,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "FoldPending" });
      })
  );

  it.effect("refuses a question that the sitting's exam does not hold", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      const other = yield* teacherExam(fixture, "Lain");
      const failure = yield* promptOf(fixture, {
        deviceId: deviceOf(1),
        questionId: other.questions[0].id,
        sittingId: made.id,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "QuestionNotInExam" });
    })
  );

  it.effect(
    "refuses the prompt to a device that does not own the attempt",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const questionId = yield* firstQuestion(fixture, made.id);
        const failure = yield* promptOf(fixture, {
          deviceId: deviceOf(2),
          questionId,
          sittingId: made.id,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SecondDevice" });
      })
  );

  it.effect(
    "reads the prompt of a locked attempt, whose paper stays on screen read-only",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const questionId = yield* firstQuestion(fixture, made.id);
        yield* fixture.as("teacher").mutation(lock, {
          attemptId: entered.attempt,
          reason: "other",
          sittingId: made.id,
          slug: nf,
        });
        const prompt = yield* promptOf(fixture, {
          deviceId: deviceOf(1),
          questionId,
          sittingId: made.id,
        });
        expect(prompt).toMatchObject({ prompt: expect.any(String) });
      })
  );
});
