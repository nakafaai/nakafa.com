import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import type { Evaluated, Outcome } from "@repo/backend/confect/response/model";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import { Effect, Number as Num, Option, Struct } from "effect";

/** What an absent answer adds to its section's counters. */
const uncounted = { answered: 0, correct: 0 };

/** What one answer adds to its section's counters: complete answers and correct outcomes. */
function countOf(isComplete: boolean, outcome: Outcome) {
  return {
    answered: isComplete ? 1 : 0,
    correct: outcome.status === "correct" ? 1 : 0,
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
 * and the section and attempt rows are replaced as loaded, so no row is read
 * again. A clear with nothing stored writes nothing. Deleting a response also
 * deletes its version, so the version only orders the writes of a stored answer.
 * @see https://docs.convex.dev/functions/mutation-functions#transactions
 */
export const writeAnswer = Effect.fn("tryouts.response.writeAnswer")(
  function* (input: {
    readonly answer: Option.Option<Evaluated>;
    readonly attempt: Docs["tryoutAttempts"];
    readonly now: number;
    readonly placement: Docs["tryoutAttemptPlacements"];
    readonly section: Docs["tryoutSectionAttempts"];
    readonly stored: Option.Option<Docs["tryoutResponses"]>;
    readonly version: Version;
  }) {
    const { answer, attempt, now, placement, section, stored, version } = input;
    const writer = yield* DatabaseWriter;
    const responses = writer.table("tryoutResponses");
    if (Option.isNone(answer)) {
      if (Option.isNone(stored)) {
        return;
      }
      yield* responses.delete(stored.value._id);
    } else {
      const fields = {
        isComplete: answer.value.isComplete,
        isCorrect: answer.value.outcome.status === "correct",
        outcome: answer.value.outcome,
        selection: answer.value.selection,
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
              tryoutAttemptId: attempt._id,
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
      onSome: (response) => countOf(response.isComplete, readOutcome(response)),
    });
    const after = Option.match(answer, {
      onNone: () => uncounted,
      onSome: (evaluated) => countOf(evaluated.isComplete, evaluated.outcome),
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
    yield* writer
      .table("tryoutAttempts")
      .replace(
        attempt._id,
        Struct.assign(Struct.omit(attempt, ["_creationTime", "_id"]), {
          lastActivityAt: now,
        })
      )
      .pipe(Effect.orDie);
  }
);
