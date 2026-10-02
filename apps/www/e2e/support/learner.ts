import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import type { BrowserContext } from "@playwright/test";
import { Effect, FileSystem, Schema } from "effect";
import { ChildProcess } from "effect/process";

const acceptanceCli = fileURLToPath(
  new URL(
    "../../../../packages/backend/scripts/content/acceptance/main.ts",
    import.meta.url
  )
);
const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);

/** Expected failure while signing a synthetic learner in. */
class LearnerSignInError extends Schema.TaggedError<LearnerSignInError>()(
  "LearnerSignInError",
  { exitCode: Schema.Finite }
) {}

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
    const child = yield* ChildProcess.make(
      process.execPath,
      [acceptanceCli, "learner", output],
      { stderr: "inherit", stdin: "ignore", stdout: "inherit" }
    );
    const exitCode = yield* child.exitCode;
    if (exitCode !== 0) {
      return yield* new LearnerSignInError({ exitCode });
    }
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
