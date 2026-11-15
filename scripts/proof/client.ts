import { HeadSha } from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, Schedule, Schema } from "effect";
import { runText } from "#scripts/process";

/** The repository whose proof workflow proves every head. */
export const REPOSITORY = "nakafaai/nakafa.com";

/** A proof that could not run, or whose run could not be read. */
export class ProofError extends Schema.TaggedError<
  ProofError,
  { readonly brand: unique symbol }
>()("ProofError", {
  message: Schema.String,
  /** Whether GitHub refused the call for the account's rate limit, which passes. */
  limited: Schema.optionalKey(Schema.Boolean),
}) {}

/**
 * Whether GitHub refused a call for the account's API rate limit, which every
 * session on this account shares: 5,000 requests an hour.
 */
const RATE_LIMITED = /rate limit/iu;

/** One attempt of a GitHub CLI call: what it printed, or what it said. */
const ghOnce = Effect.fn("proof.ghOnce")(function* (args: readonly string[]) {
  const output = yield* runText("gh", args).pipe(
    Effect.mapError(
      () => new ProofError({ message: "The GitHub CLI could not start." })
    )
  );
  if (output.code !== 0) {
    return yield* new ProofError({
      message: `gh ${Arr.join(Arr.take(args, 2), " ")} failed: ${output.stderr.trim()}`,
      limited: RATE_LIMITED.test(output.stderr),
    });
  }
  return output.stdout;
});

/**
 * Runs the GitHub CLI and returns what it printed, or fails with what it said.
 * A call refused for the rate limit waits a minute and tries again, for as long
 * as the limit stays spent, so a proof waits out any number of busy hours.
 */
export const gh = (args: readonly string[]) =>
  ghOnce(args).pipe(
    Effect.retry({
      while: (error) => error.limited === true,
      schedule: Schedule.spaced("1 minute"),
    })
  );

/** What `gh run list --json databaseId,displayTitle` prints. */
export const RunListJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({ databaseId: Schema.Int, displayTitle: Schema.String })
  )
);

/** The exact head of main now. */
export const mainHead = gh([
  "api",
  `repos/${REPOSITORY}/commits/main`,
  "--jq",
  ".sha",
]).pipe(
  Effect.map((text) => text.trim()),
  Effect.flatMap(Schema.decodeEffect(HeadSha)),
  Effect.catchTag("SchemaError", () =>
    Effect.fail(new ProofError({ message: "GitHub named no main head." }))
  )
);
