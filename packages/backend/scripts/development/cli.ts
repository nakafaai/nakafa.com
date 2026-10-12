import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { sanitizeAcceptanceCommandError } from "@repo/backend/scripts/content/acceptance/error";
import {
  Array as Arr,
  Config,
  ConfigProvider,
  Context,
  Duration,
  Effect,
  Option,
  Record as Rec,
  Schema,
  String as Str,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";

/**
 * Expected failure of a script that runs the Convex CLI on the dev deployment:
 * the check refused to let the script go on, or a command could not start, did
 * not answer in time, or failed. The message names the step and never repeats a
 * setting.
 */
export class DevelopmentCliError extends Schema.TaggedError<DevelopmentCliError>()(
  "DevelopmentCliError",
  { message: Schema.String }
) {}

const cliError = (message: string) => new DevelopmentCliError({ message });

/** No settings on top of the environment: the CLI keeps what it inherits. */
const NO_SETTINGS: Readonly<Record<string, string>> = {};

/**
 * How to start the Convex CLI: the program, its first arguments, the folder it
 * runs in, the settings it runs with on top of the environment it inherits, and
 * how long one command may take. The package's own folder holds the CLI, and
 * the `.env.local` that names the dev deployment. The deadline is generous for
 * one call to a function and stops a CLI that hangs, and a script that calls a
 * longer function sets its own. A test points the CLI at a double.
 */
export const ConvexCli = Context.Reference(
  "@repo/backend/scripts/development/cli/ConvexCli",
  {
    defaultValue: () => ({
      args: ["node_modules/convex/bin/main.js"],
      command: process.execPath,
      cwd: `${import.meta.dirname}/../..`,
      deadline: Duration.minutes(2),
      env: NO_SETTINGS,
    }),
  }
);

/** The setting that names the deployment a script runs on. */
const DEPLOYMENT_SETTING = "CONVEX_DEPLOYMENT";

/**
 * The settings that pick a deployment before `CONVEX_DEPLOYMENT` does. A
 * project key among them even ignores `CONVEX_DEPLOYMENT`, so a script runs
 * with neither.
 */
const KEY_SETTINGS = ["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT_TOKEN"];

/** The type the Convex CLI writes in front of the name of a dev deployment. */
const DEVELOPMENT = "dev:";

/** The file that names the dev deployment, which the CLI loads from its folder. */
const LOCAL_FILE = ".env.local";

/**
 * The settings of the `.env.local` in the folder the CLI runs in, which the CLI
 * itself loads into the settings that are not set. A folder without that file
 * has no settings. A file that cannot be read fails, because the check could
 * not tell what the CLI would load.
 */
const localSettings = Effect.fn("development.localSettings")(function* () {
  const cli = yield* ConvexCli;
  return yield* ConfigProvider.fromDotEnv({
    path: `${cli.cwd}/${LOCAL_FILE}`,
  }).pipe(
    Effect.catchReason("PlatformError", "NotFound", () =>
      Effect.succeed(ConfigProvider.fromEnvRecord({}))
    ),
    Effect.mapError((error) =>
      cliError(`${LOCAL_FILE} could not be read: ${error.message}`)
    )
  );
});

/** Reads one setting from a provider, blank when it is not set. */
const readSetting =
  (provider: ConfigProvider.ConfigProvider) => (name: string) =>
    Config.option(Config.NonEmptyString(name))
      .parse(provider)
      .pipe(Effect.map(Option.getOrElse(() => "")), Effect.orDie);

/**
 * Lets a script go on only when the caller's configuration names a dev
 * deployment and holds no deploy key and no deployment token. The caller's
 * configuration is the environment and then the `.env.local` in the folder of
 * the CLI, where the CLI finds the dev deployment of this checkout. A script
 * that spends credits runs where the caller already develops, which is that
 * dev deployment. A key or a token picks the deployment before the name does,
 * and one kind of key ignores the name, so with either set nothing here could
 * say where the script would run. The messages never repeat a setting, which
 * may hold a key.
 *
 * It returns the settings the CLI must run with: the deployment it checked, and
 * the key and the token blank. After it starts, the CLI loads `.env.local` and
 * `.env` into the settings that are not set, and the `.env` file, which the
 * check does not read, could name a production deploy key. A blank setting is
 * set, so no file can fill it in, and the CLI goes where the check looked.
 */
export const requireDevelopment = Effect.fn("development.requireDevelopment")(
  function* () {
    const environment = yield* ConfigProvider.ConfigProvider;
    const local = yield* localSettings();
    const read = readSetting(ConfigProvider.orElse(environment, local));
    const deployment = yield* read(DEPLOYMENT_SETTING);
    const keys = yield* Effect.forEach(KEY_SETTINGS, read);
    if (Arr.some(keys, Str.isNonEmpty)) {
      return yield* cliError(
        "Refusing to run with a deploy key or a deployment token set. Unset CONVEX_DEPLOY_KEY and CONVEX_DEPLOYMENT_TOKEN, so that CONVEX_DEPLOYMENT alone names the deployment."
      );
    }
    if (Str.isEmpty(deployment)) {
      return yield* cliError(
        "No deployment is configured. Set CONVEX_DEPLOYMENT, as packages/backend/.env.local does for the dev deployment."
      );
    }
    if (
      !deployment.startsWith(DEVELOPMENT) ||
      deployment.includes(CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT)
    ) {
      return yield* cliError(
        "Refusing to run against a deployment that is not a dev deployment. A script that spends credits runs only on a dev deployment, so CONVEX_DEPLOYMENT must name one."
      );
    }
    return {
      [DEPLOYMENT_SETTING]: deployment,
      ...Rec.fromEntries(Arr.map(KEY_SETTINGS, (name) => [name, ""] as const)),
    };
  }
);

/** Collects one output stream of a child process as text. */
const collect = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(Stream.decodeText(), Stream.mkString);

/**
 * Runs the Convex CLI once, with the settings of `ConvexCli` on top of the
 * environment it inherits, and returns what it printed. A failed command
 * reports its error output without any of `sensitiveValues`.
 */
export const runConvex = Effect.fn("development.runConvex")(function* (
  operation: string,
  args: readonly string[],
  sensitiveValues: readonly string[] = []
) {
  const cli = yield* ConvexCli;
  const [stdout, stderr, code] = yield* Effect.gen(function* () {
    const child = yield* ChildProcess.make(
      cli.command,
      [...cli.args, ...args],
      { cwd: cli.cwd, env: cli.env, extendEnv: true, stdin: "ignore" }
    );
    return yield* Effect.all(
      [collect(child.stdout), collect(child.stderr), child.exitCode],
      { concurrency: "unbounded" }
    );
  }).pipe(
    Effect.scoped,
    Effect.mapError((error) =>
      cliError(`${operation} could not run the Convex CLI: ${error.message}`)
    ),
    // A command that times out is interrupted, which stops its process.
    Effect.timeoutOrElse({
      duration: cli.deadline,
      orElse: () =>
        Effect.fail(
          cliError(
            `${operation} did not answer within ${Duration.format(cli.deadline)}.`
          )
        ),
    })
  );
  if (code !== 0) {
    const detail = sanitizeAcceptanceCommandError(stderr, sensitiveValues);
    return yield* cliError(
      detail.length > 0
        ? `${operation} failed: ${detail}`
        : `${operation} failed.`
    );
  }
  return stdout;
});
