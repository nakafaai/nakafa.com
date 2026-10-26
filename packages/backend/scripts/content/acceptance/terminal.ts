import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Array as Arr, Effect } from "effect";
import { ChildProcess } from "effect/process";

/** Keeps terminal hangup on NodeRuntime's graceful interruption path until cleanup finishes. */
export const withTerminal = Effect.fn("contentAcceptance.withTerminal")(
  function* <A, E, R>(program: Effect.Effect<A, E, R>) {
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        // bun may exit before this process, causing its terminal to hang up.
        const interrupt = () => process.emit("SIGINT");
        process.on("SIGHUP", interrupt);
        return interrupt;
      }),
      (interrupt) =>
        Effect.sync(() => process.removeListener("SIGHUP", interrupt))
    );
    return yield* program;
  },
  Effect.scoped
);

/** Runs application tools while keeping private signing and cloud deployment credentials out. */
export const runBuildCommand = Effect.fn("contentAcceptance.runBuildCommand")(
  function* (
    cwd: string,
    [command, ...args]: readonly [string, ...string[]],
    env: Readonly<Record<string, string | undefined>> = {}
  ) {
    const child = yield* ChildProcess.make(command, args, {
      cwd,
      env: {
        ...env,
        AKSARA_ACCEPTANCE_PRIVATE_KEY: undefined,
        AKSARA_SIGNING_PRIVATE_KEY: undefined,
        CONVEX_DEPLOY_KEY: undefined,
        CONVEX_DEPLOYMENT_TOKEN: undefined,
      },
      extendEnv: true,
      // Turbo's wrapper forwards SIGTERM, duplicating the process-group signal.
      killSignal: "SIGINT",
      // Let the build and the served app stop their children before escalating.
      forceKillAfter: "15 seconds",
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = yield* child.exitCode;
    if (code !== 0) {
      return yield* acceptanceRuntimeError(
        `${command} ${Arr.join(args, " ")} failed with exit code ${code}.`
      );
    }
  }
);
