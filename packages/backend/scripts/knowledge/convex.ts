import {
  compareInputValidator,
  compareResultValidator,
} from "@repo/backend/confect/contents/sections/compare.spec";
import { runConvex } from "@repo/backend/scripts/development/cli";
import { Effect, Schema } from "effect";

/**
 * Where the model comparison lives in a deployment: its module and its export.
 * The script cannot load the generated references, because they load every
 * function of the backend, so it names the function and takes the shape of its
 * arguments and answer from the contract that the function declares. A test
 * holds this path to the name that the references give the function.
 */
const RANK_PATH = "contents/sections/compare:rank";

/**
 * The arguments of the function as the CLI takes them, one JSON text in one
 * command line argument. A run of about 50 questions is about 9 KB, far below
 * the limit of one argument (128 KiB on Linux, and 1 MiB for all arguments and
 * the environment on macOS), so no other way to hand them over is needed.
 */
const Arguments = Schema.fromJsonString(compareInputValidator);

/** What the CLI prints when the function returns: its result, as the function declares it. */
const Answer = Schema.fromJsonString(compareResultValidator);

/** Why the CLI printed something other than the answer that the function declares. */
class KnowledgeConvexError extends Schema.TaggedError<KnowledgeConvexError>()(
  "KnowledgeConvexError",
  { message: Schema.String }
) {}

/**
 * Runs the model comparison of the dev deployment for one model and one
 * language with the Convex CLI, and gives back its answer as the function
 * declares it. The function is internal, and the CLI holds the credential that
 * reaches it. A failure of the function, such as the gateway refusing a
 * request, makes the CLI exit with an error, which `runConvex` reports with
 * what the CLI printed.
 */
export const rankModel = Effect.fn("knowledge.rankModel")(function* (
  input: typeof compareInputValidator.Type
) {
  const args = yield* Schema.encodeEffect(Arguments)(input).pipe(Effect.orDie);
  const printed = yield* runConvex("Model test", ["run", RANK_PATH, args]);
  return yield* Schema.decodeEffect(Answer)(printed).pipe(
    Effect.mapError(
      (error) =>
        new KnowledgeConvexError({
          message: `Model test printed an answer that the function does not declare: ${error.message}`,
        })
    )
  );
});
