import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { fitsQuestion } from "@repo/backend/confect/assessment/fit";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import type { Grade } from "@repo/backend/confect/assessment/grade";
import { grade } from "@repo/backend/confect/assessment/grade";
import {
  answersQuestion,
  findPart,
  fitsParts,
  isPartsResponse,
  QuestionGrade,
  QuestionResponse,
  sumParts,
} from "@repo/backend/confect/assessment/parts";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { NO_RESPONSE } from "@repo/backend/confect/assessment/response";
import { TryoutResponseUnfitError } from "@repo/backend/confect/tryouts/response/spec";
import type {
  PlacedInteraction,
  PlacedQuestion,
} from "@repo/backend/confect/tryouts/runtime/question";
import {
  Array as Arr,
  Effect,
  Number as Num,
  Option,
  Result,
  Schema,
  Struct,
} from "effect";

/** A learner's admitted answer to one place: the response and how its frozen rules grade it. */
export const GradedAnswer = Schema.Struct({
  grade: QuestionGrade,
  response: QuestionResponse,
});
export type GradedAnswer = typeof GradedAnswer.Type;

/** Whether a grade earns every point of its question, which counts it correct. */
export const isCorrectGrade = (graded: Grade) =>
  graded.status === "scored" && graded.category === graded.ceiling;

/**
 * Settles the grade of a short answer that no accepted answer matches. The shared grader leaves it for a person,
 * as a School teacher decides it, but no person grades a try-out, so it scores nothing, as a number outside its
 * tolerance does. A written answer (or a math entry whose key cannot be parsed as an expression) stays pending
 * until judged, so the attempt's score stays provisional and says so.
 */
const settled = (placed: PlacedInteraction, graded: Grade): Grade =>
  graded.status === "pending" && placed.interaction.kind === "textEntry"
    ? { category: 0, ceiling: graded.ceiling, status: "scored" }
    : graded;

/** Grades one interaction's response by its own frozen key and rule, settled for a try-out (`settled`). */
const gradeInteraction = (placed: PlacedInteraction, response: ExamResponse) =>
  settled(placed, grade({ ...placed, response }));

/**
 * Grades a response to a question by its frozen interactions. A question of one interaction grades its response by
 * that interaction's rule. A question of several grades each part's response by the part's own rule, a blank part
 * scoring nothing, and sums them (`sumParts`), so the question is worth every part's points.
 */
export function gradeQuestion(
  question: PlacedQuestion,
  response: QuestionResponse
): QuestionGrade {
  const [first, ...later] = question.interactions;
  if (Arr.isReadonlyArrayEmpty(later) && !isPartsResponse(response)) {
    return gradeInteraction(first, response);
  }
  return sumParts(
    Arr.map(question.interactions, (placed) => ({
      grade: gradeInteraction(
        placed,
        Option.getOrElse(
          findPart(response, placed.interaction.id),
          () => NO_RESPONSE
        )
      ),
      interaction: placed.interaction.id,
    }))
  );
}

/**
 * Whether a response fits a place's frozen question: the response to its one interaction (`fitsQuestion`), or the
 * parts of a question of several (`fitsParts`).
 */
const fitsPlaced = (question: PlacedQuestion, response: QuestionResponse) => {
  const interactions = Arr.map(
    question.interactions,
    (placed) => placed.interaction
  );
  return interactions.length === 1
    ? !isPartsResponse(response) && fitsQuestion(interactions, response)
    : fitsParts(interactions, response);
};

/**
 * Grades one response to a place with the place's frozen interactions, keys, and rules (`readPlacedQuestion`,
 * `gradeQuestion`). A response that does not fit the question (`fitsPlaced`) is refused. It returns a `Result`, not
 * an Effect, so the integrity check re-grades stored answers with the same synchronous step.
 */
export function gradeAnswer(
  question: PlacedQuestion,
  response: QuestionResponse
): Result.Result<GradedAnswer, TryoutResponseUnfitError> {
  if (!fitsPlaced(question, response)) {
    return Result.fail(
      new TryoutResponseUnfitError({
        code: "TRYOUT_RESPONSE_UNFIT",
        message: "Try-out response does not fit its frozen question.",
      })
    );
  }
  return Result.succeed({
    grade: gradeQuestion(question, response),
    response,
  });
}

/** What an absent answer adds to its section's counters. */
const uncounted = { answered: 0, correct: 0 };

/** What one answer adds to its section's counters: answered questions and correct grades. */
function countOf(answer: GradedAnswer) {
  return {
    answered: answersQuestion(answer.response) ? 1 : 0,
    correct: isCorrectGrade(answer.grade) ? 1 : 0,
  };
}

/** Seconds since the section started, bounded by its time limit, from server timestamps. */
function timeSpentOf(section: Docs["tryoutSectionAttempts"], now: number) {
  return Num.clamp(Math.floor((now - section.startedAt) / 1000), {
    maximum: Math.max(
      0,
      Math.floor((section.expiresAt - section.startedAt) / 1000)
    ),
    minimum: 0,
  });
}

/**
 * Writes one admitted answer and its section counters in the admitting
 * transaction. The stored response, read and checked when the answer was
 * admitted, is replaced (keeping its first answer time) or deleted for none,
 * and the section row is replaced as loaded, so no row is read again. The
 * attempt row stays as it is: every query of the attempt reads it, so a write
 * here would run them all again on each answer. Deleting a response deletes the version it carried, so a clear
 * replaces the placement with the clear's version, which orders the writes
 * that follow it. A clear with nothing stored changes nothing else.
 * @see https://docs.convex.dev/functions/mutation-functions#transactions
 */
export const writeAnswer = Effect.fn("tryouts.response.writeAnswer")(
  function* (input: {
    readonly answer: Option.Option<GradedAnswer>;
    readonly now: number;
    readonly placement: Docs["tryoutAttemptPlacements"];
    readonly section: Docs["tryoutSectionAttempts"];
    readonly stored: Option.Option<Docs["tryoutResponses"]>;
    readonly version: Version;
  }) {
    const { answer, now, placement, section, stored, version } = input;
    const writer = yield* DatabaseWriter;
    const responses = writer.table("tryoutResponses");
    if (Option.isNone(answer)) {
      yield* writer
        .table("tryoutAttemptPlacements")
        .replace(
          placement._id,
          Struct.assign(Struct.omit(placement, ["_creationTime", "_id"]), {
            clearedVersion: version,
          })
        )
        .pipe(Effect.orDie);
      if (Option.isNone(stored)) {
        return;
      }
      yield* responses.delete(stored.value._id);
    } else {
      const fields = {
        grade: answer.value.grade,
        response: answer.value.response,
        timeSpent: timeSpentOf(section, now),
        updatedAt: now,
        version,
      };
      yield* Option.match(stored, {
        onNone: () =>
          responses.insert(
            Struct.assign(fields, {
              answeredAt: now,
              placementId: placement._id,
              tryoutAttemptId: placement.tryoutAttemptId,
              tryoutSectionAttemptId: section._id,
            })
          ),
        onSome: (response) =>
          responses.replace(
            response._id,
            Struct.assign(
              Struct.omit(response, ["_creationTime", "_id"]),
              fields
            )
          ),
      }).pipe(Effect.orDie);
    }
    const before = Option.match(stored, {
      onNone: () => uncounted,
      onSome: countOf,
    });
    const after = Option.match(answer, {
      onNone: () => uncounted,
      onSome: countOf,
    });
    yield* writer
      .table("tryoutSectionAttempts")
      .replace(
        section._id,
        Struct.assign(Struct.omit(section, ["_creationTime", "_id"]), {
          answeredCount:
            section.answeredCount + after.answered - before.answered,
          correctAnswers:
            section.correctAnswers + after.correct - before.correct,
          lastActivityAt: now,
        })
      )
      .pipe(Effect.orDie);
  }
);
