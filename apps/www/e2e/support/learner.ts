import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import type { BrowserContext } from "@playwright/test";
import { Effect, FileSystem, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";

const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);

/**
 * Signs a new synthetic learner into one browser context. The running local
 * acceptance runtime creates the learner and its session in its own database,
 * so each test starts from a learner with no attempts and no real account is
 * ever involved.
 */
export const signInLearner = Effect.fn("NakafaE2E.signInLearner")(
  function* (context: BrowserContext, baseURL: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-learner-",
    });
    const output = `${directory}/cookie.json`;
    // Convex stops a query or mutation after one second of its own code
    // (https://docs.convex.dev/production/state/limits), and the local backend
    // has no setting to raise that. A machine busy with other work stretches
    // the functions this command calls past it now and then ("Function
    // execution timed out (maximum duration: 1s)"), and the command only exits
    // with a code, so any failure is tried again. The command writes the
    // cookie file last, so a run that failed leaves no cookie and the next one
    // signs in a new learner. The account of the failed run may stay in the
    // local database, which is thrown away with the runtime.
    yield* runAcceptanceCommand("learner", output).pipe(
      Effect.retry({ times: 2 })
    );
    const cookie = yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
    yield* Effect.promise(() =>
      context.addCookies([
        {
          httpOnly: true,
          name: cookie.name,
          sameSite: "Lax",
          url: baseURL,
          value: cookie.value,
        },
      ])
    );
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);
