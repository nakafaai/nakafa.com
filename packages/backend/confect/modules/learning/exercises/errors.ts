import { Effect, Schema } from "effect";

/** Expected exercise-domain failure transported by Confect. */
export class ExerciseError extends Schema.TaggedError<ExerciseError>()(
  "ExerciseError",
  {
    code: Schema.String,
    expiresAtMs: Schema.optional(Schema.Number),
    message: Schema.String,
  }
) {}

/** Fails with a typed exercise error. */
export function failExercise(
  code: string,
  message: string,
  expiresAtMs?: number
) {
  return Effect.fail(new ExerciseError({ code, expiresAtMs, message }));
}
