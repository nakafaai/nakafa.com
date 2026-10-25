import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Effect, Option, Schema } from "effect";

/** The kinds of attempt that share the flags table: a school sitting and a consumer try-out. */
const FlagKind = Schema.Literals(["sitting", "tryout"]);
type FlagKind = typeof FlagKind.Type;

/**
 * One question flagged for review in one attempt, shared by school sittings and try-outs
 * (ADR 0031). `attempt` is the ID of an `examAttempts` row for a sitting and of a
 * `tryoutAttempts` row for a try-out. `question` is the ID of the question for a sitting
 * and of the placement for a try-out. A row exists only while its question is flagged.
 */
export const assessmentFlagValidator = Schema.Struct({
  attempt: Schema.String,
  kind: FlagKind,
  question: Schema.String,
});

/**
 * Flags or unflags one question of one attempt. It writes the row only when the flag
 * changes, so a repeated flag or unflag changes nothing. Callers pass it through the gate.
 */
export const setAssessmentFlag = Effect.fn("assessment.flags.set")(
  function* (input: {
    readonly attempt: string;
    readonly flagged: boolean;
    readonly kind: FlagKind;
    readonly question: string;
  }) {
    const existing = yield* (yield* DatabaseReader)
      .table("assessmentFlags")
      .index("by_attempt_and_question", (query) =>
        query.eq("attempt", input.attempt).eq("question", input.question)
      )
      .first()
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    if (input.flagged && Option.isNone(existing)) {
      yield* writer
        .table("assessmentFlags")
        .insert({
          attempt: input.attempt,
          kind: input.kind,
          question: input.question,
        })
        .pipe(Effect.orDie);
    }
    if (!input.flagged && Option.isSome(existing)) {
      yield* writer
        .table("assessmentFlags")
        .delete(existing.value._id)
        .pipe(Effect.orDie);
    }
  }
);
