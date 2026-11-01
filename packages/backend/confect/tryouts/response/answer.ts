import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { fitsQuestion } from "@repo/backend/confect/assessment/fit";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import { Grade, grade } from "@repo/backend/confect/assessment/grade";
import {
  ExamResponse,
  isAnswered,
} from "@repo/backend/confect/assessment/response";
import { TryoutResponseUnfitError } from "@repo/backend/confect/tryouts/response/spec";
import type { PlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import { Effect, Number as Num, Option, Result, Schema, Struct } from "effect";

/** A learner's admitted answer to one place: the response and how its frozen rule grades it. */
export const GradedAnswer = Schema.Struct({
  grade: Grade,
  response: ExamResponse,
});
export type GradedAnswer = typeof GradedAnswer.Type;

/** Whether a grade earns every point of its question, which counts it correct. */
export const isCorrectGrade = (graded: Grade) =>
  graded.status === "scored" && graded.category === graded.ceiling;

/**
 * Grades one response to a place with the place's frozen interaction, key, and rule
 * (`readPlacedQuestion`). A response that does not fit the interaction (`fitsQuestion`) is refused. It
 * returns a `Result`, not an Effect, so the integrity check re-grades stored answers with the same
 * synchronous step.
 */
export function gradeAnswer(
  question: PlacedQuestion,
  response: ExamResponse
): Result.Result<GradedAnswer, TryoutResponseUnfitError> {
  if (!fitsQuestion([question.interaction], response)) {
    return Result.fail(
      new TryoutResponseUnfitError({
        code: "TRYOUT_RESPONSE_UNFIT",
        message: "Try-out response does not fit its frozen question.",
      })
    );
  }
  return Result.succeed({
    grade: grade({ ...question, response }),
    response,
  });
}

/** What an absent answer adds to its section's counters. */
const uncounted = { answered: 0, correct: 0 };

/** What one answer adds to its section's counters: answered questions and correct grades. */
function countOf(answer: GradedAnswer) {
  return {
    answered: isAnswered(answer.response) ? 1 : 0,
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
