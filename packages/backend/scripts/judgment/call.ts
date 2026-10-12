import {
  measureInputValidator,
  measureResultValidator,
} from "@repo/backend/confect/nina/judgment.spec";
import { runConvex } from "@repo/backend/scripts/development/cli";
import { Array as Arr, Effect, Schema } from "effect";

/**
 * Where the measuring action lives in a deployment: its module and its export.
 * The script cannot load the generated references, because they load every
 * function of the backend and with it modules that the script runner cannot
 * load, so it names the function and takes the shape of its arguments and
 * answer from the contract that the function declares. A test holds this path
 * to the name that the references give the function.
 */
const MEASURE_PATH = "nina/judgment:measure";

/**
 * The arguments of the action as the CLI takes them, one JSON text in one
 * command line argument. The largest call of the labelled set, 30 notes, is
 * 3,635 bytes (measured on 12 October 2026), far below the limit of one
 * argument (128 KiB on Linux, and 1 MiB for all arguments and the environment
 * on macOS), so no other way to hand them over is needed.
 */
const Arguments = Schema.fromJsonString(measureInputValidator);

/** What the CLI prints when the action returns: its result, as the action declares it. */
const Answer = Schema.fromJsonString(measureResultValidator);

/**
 * Why the measuring command stopped: the command line asks for something it
 * does not do, the deployment cannot reach the gateway, or its answer is
 * something the command cannot use. A Convex CLI that cannot run, does not
 * answer in time or fails is a `DevelopmentCliError` instead.
 */
export class JudgmentCallError extends Schema.TaggedError<JudgmentCallError>()(
  "JudgmentCallError",
  { message: Schema.String }
) {}

/**
 * Runs the measuring action of the dev deployment on some texts with the Convex
 * CLI, and gives back its measurement. The action is internal, and the CLI
 * holds the credential that reaches it. When the deployment cannot reach the
 * gateway, the action answers with that failure, because the CLI prints a
 * failed call as text and drops the typed data of its error; the call then
 * fails with the reason. When the action cannot run at all, such as when the
 * deployment does not have it yet, the CLI exits with an error, which
 * `runConvex` reports with the start of what the CLI printed. An answer that
 * holds more or fewer rows than the texts it was given is refused, because a
 * row that matched no text would be matched with the wrong one.
 */
export const callMeasure = Effect.fn("judgment.callMeasure")(function* (
  input: typeof measureInputValidator.Type
) {
  const args = yield* Schema.encodeEffect(Arguments)(input).pipe(Effect.orDie);
  const printed = yield* runConvex("Judgment measure", [
    "run",
    MEASURE_PATH,
    args,
  ]);
  const answer = yield* Schema.decodeEffect(Answer)(printed).pipe(
    Effect.mapError(
      (error) =>
        new JudgmentCallError({
          message: `Judgment measure printed an answer that the action does not declare: ${error.message}`,
        })
    )
  );
  if (answer.kind === "failed") {
    return yield* new JudgmentCallError({
      message: `Judgment measure failed: ${answer.failure.message}`,
    });
  }
  if (Arr.length(answer.rows) !== Arr.length(input.texts)) {
    return yield* new JudgmentCallError({
      message: `Judgment measure: the deployment measured ${Arr.length(answer.rows)} of ${Arr.length(input.texts)} texts`,
    });
  }
  return answer;
});
