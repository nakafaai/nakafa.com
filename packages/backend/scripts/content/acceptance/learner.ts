import { openLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import { retryFunctionTimeout } from "@repo/backend/scripts/content/acceptance/error";
import {
  SessionCookies,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * Signs one synthetic learner into the running local acceptance backend and
 * answers that learner's session cookies. The learner exists only in this
 * runtime's local database, and Convex Auth's password method signs it in, so
 * the session is one the deployment made. Each call creates a new learner, so
 * every test starts from a learner without attempts.
 */
export const seedLearner = Effect.fn("contentAcceptance.seedLearner")(
  function* () {
    const { run } = yield* LocalConvex;
    // A loaded machine pushes the local backend past its function time limit, and
    // the learner's setup is not what a browser test checks, so it tries again.
    const account = yield* retryFunctionTimeout(openLearnerAccount(run));
    return account.cookies;
  }
);

/** The usage of the learner mode, which names the file that the session cookies go to. */
const USAGE = "learner <cookie-file>";
const LearnerArguments = Schema.Tuple([Schema.String]);

/**
 * The learner mode of the acceptance command line: signs one synthetic learner in
 * and writes its session cookies to the file that the command names.
 */
export const learnerMode = {
  mode: "learner",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runLearner")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [output] = yield* decodeModeArguments(USAGE, LearnerArguments, args);
    const cookies = yield* seedLearner().pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SessionCookies, cookies);
  }),
} satisfies AcceptanceMode;
