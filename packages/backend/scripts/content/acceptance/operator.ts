import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import { retryFunctionTimeout } from "@repo/backend/scripts/content/acceptance/error";
import {
  SessionCookie,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  SESSION_LIFETIME,
  sessionCookieOf,
} from "@repo/backend/scripts/content/acceptance/learner";
import { appUserOf } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

/**
 * Signs one synthetic operator into the running local acceptance backend and
 * answers its session cookie: a new learner, granted operator access as Nakafa
 * staff grant it, with the deployment's key.
 */
export const seedOperator = Effect.fn("contentAcceptance.seedOperator")(
  function* () {
    const { run } = yield* LocalConvex;
    const { token, userId } = yield* retryFunctionTimeout(
      createLearnerAccount(run, SESSION_LIFETIME)
    );
    const appUser = yield* appUserOf(run, userId);
    yield* run("operator grant", {
      args: { userId: appUser },
      path: "operators/staff:grant",
    });
    return yield* sessionCookieOf(token);
  }
);

/** The usage of the operator mode, which names the file that the session cookie goes to. */
const USAGE = "operator <cookie-file>";
const OperatorArguments = Schema.Tuple([Schema.String]);

/**
 * The operator mode of the acceptance command line: signs one synthetic operator
 * in and writes its session cookie to the file that the command names.
 */
export const operatorMode = {
  mode: "operator",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runOperator")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [output] = yield* decodeModeArguments(USAGE, OperatorArguments, args);
    const cookie = yield* seedOperator().pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SessionCookie, cookie);
  }),
} satisfies AcceptanceMode;
