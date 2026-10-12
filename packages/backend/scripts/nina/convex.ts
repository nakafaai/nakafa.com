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

/**
 * The settings the CLI reads to pick a deployment. A deploy key and a
 * deployment token each pick one before `CONVEX_DEPLOYMENT` does.
 */
const DEPLOYMENT_SETTINGS = [
  "CONVEX_DEPLOYMENT",
  "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT_TOKEN",
];

/** Whether a deployment name or a deploy key belongs to the production deployment. */
function namesProduction(setting: string) {
  return (
    setting.startsWith("prod:") ||
    setting.includes(CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT)
  );
}

/**
 * Refuses to go on unless the caller's configuration names a deployment, and
 * refuses the production deployment whatever the way it is named. The gate
 * creates a learner and spends credits, so it runs where the caller already
 * develops, which is the dev deployment in `packages/backend/.env.local`. The
 * messages never repeat a setting, which may hold a key.
 *
 * It returns the settings the CLI must run with: each one the caller named, and
 * every other setting that picks a deployment, blank. After it starts, the CLI
 * loads `.env.local` and `.env` into the settings that are not set, and a file
 * the check did not read could name a production deploy key. A blank setting is
 * set, so no file can fill it in, and the CLI goes where the check looked.
 */
export const requireDevelopment = Effect.fn("ninaGate.requireDevelopment")(
  function* () {
    const values = yield* Effect.forEach(DEPLOYMENT_SETTINGS, (name) =>
      Config.option(Config.NonEmptyString(name)).pipe(
        Effect.map(Option.getOrElse(() => ""))
      )
    ).pipe(Effect.orDie);
    const named = Arr.filter(values, Str.isNonEmpty);
    if (Arr.isReadonlyArrayEmpty(named)) {
      return yield* gateError(
        "No deployment is configured. Set CONVEX_DEPLOYMENT, as packages/backend/.env.local does for the dev deployment."
      );
    }
    if (Arr.some(named, namesProduction)) {
      return yield* gateError(
        "Refusing to run against the production deployment. The gate creates a learner and spends credits, so it runs on the dev deployment."
      );
    }
    return Rec.fromEntries(Arr.zip(DEPLOYMENT_SETTINGS, values));
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
