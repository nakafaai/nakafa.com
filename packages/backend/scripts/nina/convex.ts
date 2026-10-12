import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { sanitizeAcceptanceCommandError } from "@repo/backend/scripts/content/acceptance/error";
import { gateError } from "@repo/backend/scripts/nina/error";
import {
  Array as Arr,
  Config,
  Context,
  Duration,
  Effect,
  Option,
  Record as Rec,
  String as Str,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";

/** No settings on top of the environment: the CLI keeps what it inherits. */
const NO_SETTINGS: Readonly<Record<string, string>> = {};

/**
 * How to start the Convex CLI: the program, its first arguments, the folder it
 * runs in, the settings it runs with on top of the environment it inherits, and
 * how long one command may take. The package's own folder holds the CLI, and
 * the `.env.local` that names the dev deployment. The deadline is generous for
 * one call to a function and stops a CLI that hangs. A test points the CLI at a
 * double.
 */
export const ConvexCli = Context.Reference(
  "@repo/backend/scripts/nina/convex/ConvexCli",
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

/** The setting that names the deployment the gate runs on. */
const DEPLOYMENT_SETTING = "CONVEX_DEPLOYMENT";

/**
 * The settings that pick a deployment before `CONVEX_DEPLOYMENT` does. A
 * project key among them even ignores `CONVEX_DEPLOYMENT`, so the gate runs
 * with neither.
 */
const KEY_SETTINGS = ["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT_TOKEN"];

/** The type the Convex CLI writes in front of the name of a dev deployment. */
const DEVELOPMENT = "dev:";

/** Reads one setting of the caller's configuration, blank when it is not set. */
const readSetting = (name: string) =>
  Config.option(Config.NonEmptyString(name)).pipe(
    Effect.map(Option.getOrElse(() => "")),
    Effect.orDie
  );

/**
 * Lets the gate go on only when the caller's configuration names a dev
 * deployment and holds no deploy key and no deployment token. The gate creates
 * a learner and spends credits, so it runs where the caller already develops,
 * which is the dev deployment in `packages/backend/.env.local`. A key or a
 * token picks the deployment before the name does, and one kind of key ignores
 * the name, so with either set nothing here could say where the gate would
 * run. The messages never repeat a setting, which may hold a key.
 *
 * It returns the settings the CLI must run with: the deployment it checked, and
 * the key and the token blank. After it starts, the CLI loads `.env.local` and
 * `.env` into the settings that are not set, and a file the check did not read
 * could name a production deploy key. A blank setting is set, so no file can
 * fill it in, and the CLI goes where the check looked.
 */
export const requireDevelopment = Effect.fn("ninaGate.requireDevelopment")(
  function* () {
    const deployment = yield* readSetting(DEPLOYMENT_SETTING);
    const keys = yield* Effect.forEach(KEY_SETTINGS, readSetting);
    if (Arr.some(keys, Str.isNonEmpty)) {
      return yield* gateError(
        "Refusing to run with a deploy key or a deployment token set. Unset CONVEX_DEPLOY_KEY and CONVEX_DEPLOYMENT_TOKEN, so that CONVEX_DEPLOYMENT alone names the deployment."
      );
    }
    if (Str.isEmpty(deployment)) {
      return yield* gateError(
        "No deployment is configured. Set CONVEX_DEPLOYMENT, as packages/backend/.env.local does for the dev deployment."
      );
    }
    if (
      !deployment.startsWith(DEVELOPMENT) ||
      deployment.includes(CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT)
    ) {
      return yield* gateError(
        "Refusing to run against a deployment that is not a dev deployment. The gate creates a learner and spends credits, so CONVEX_DEPLOYMENT must name a dev deployment."
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
export const runConvex = Effect.fn("ninaGate.runConvex")(function* (
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
      gateError(`${operation} could not run the Convex CLI: ${error.message}`)
    ),
    // A command that times out is interrupted, which stops its process.
    Effect.timeoutOrElse({
      duration: cli.deadline,
      orElse: () =>
        Effect.fail(
          gateError(
            `${operation} did not answer within ${Duration.format(cli.deadline)}.`
          )
        ),
    })
  );
  if (code !== 0) {
    const detail = sanitizeAcceptanceCommandError(stderr, sensitiveValues);
    return yield* gateError(
      detail.length > 0
        ? `${operation} failed: ${detail}`
        : `${operation} failed.`
    );
  }
  return stdout;
});
