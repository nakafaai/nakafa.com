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
    // The local backend stops a function after one second, which a busy machine
    // can exceed now and then. The command writes the cookie file last, so a
    // run that failed leaves nothing behind, and the next one makes a new learner.
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
