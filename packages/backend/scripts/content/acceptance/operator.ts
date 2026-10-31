import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import {
  acceptanceRuntimeError,
  retryFunctionTimeout,
} from "@repo/backend/scripts/content/acceptance/error";
import {
  SESSION_LIFETIME,
  writeSessionCookie,
} from "@repo/backend/scripts/content/acceptance/learner";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  appUserOf,
  encodeArguments,
} from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * Signs one synthetic operator into the running local acceptance backend: a new
 * learner, granted operator access as Nakafa staff grant it, with the deployment's
 * key. Its session cookie goes to `output`, mode 600, for a browser test to send.
 */
export const createAcceptanceOperator = Effect.fn(
  "contentAcceptance.createOperator"
)(function* (root: string, output: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare and start acceptance before creating an operator."
    );
  }
  const run = (
    operation: string,
    args: readonly string[],
    sensitiveValues?: readonly string[]
  ) => runLocalConvex(runtime, operation, args, sensitiveValues);
  const { token, userId } = yield* retryFunctionTimeout(
    createLearnerAccount(run, SESSION_LIFETIME)
  );
  const appUser = yield* appUserOf(run, userId);
  yield* encodeArguments({ userId: appUser }).pipe(
    Effect.flatMap((args) =>
      run("operator grant", ["run", "operators/staff:grant", args])
    )
  );
  yield* writeSessionCookie(output, token);
});

/** The usage of the operator mode, which names the file that the session cookie goes to. */
const USAGE = "operator <cookie-file>";
const OperatorArguments = Schema.Tuple([Schema.String]);

/**
 * The operator mode of the acceptance command line: signs one synthetic operator in
 * and writes its session cookie to the file that the command names.
 */
export const operatorMode = {
  mode: "operator",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runOperator")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [output] = yield* decodeModeArguments(USAGE, OperatorArguments, args);
    return yield* createAcceptanceOperator(root, output);
  }),
} satisfies AcceptanceMode;
