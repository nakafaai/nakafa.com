import { createServer } from "node:net";
import {
  acceptanceRuntimeError,
  sanitizeAcceptanceCommandError,
} from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Effect, FileSystem, Schedule, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

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
      // Let Portless finish its 10-second descendant shutdown before escalating.
      forceKillAfter: "15 seconds",
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = yield* child.exitCode;
    if (code !== 0) {
      return yield* acceptanceRuntimeError(
        `${command} ${args.join(" ")} failed with exit code ${code}.`
      );
    }
  }
);

/**
 * Removes cloud selection before anonymous Convex initialization.
 * Convex 1.45 checks these host markers before its anonymous fallback.
 * @see https://github.com/get-convex/convex-js/blob/main/src/cli/lib/envvars.ts
 */
export const localConvexEnvironment = {
  CF_PAGES: undefined,
  AKSARA_ACCEPTANCE_PRIVATE_KEY: undefined,
  AKSARA_SIGNING_PRIVATE_KEY: undefined,
  AKSARA_AGENT_SIGNING_KEY_ID: undefined,
  AKSARA_AGENT_SIGNING_PUBLIC_KEY: undefined,
  CONVEX_AGENT_MODE: "anonymous",
  CONVEX_DEPLOY_KEY: undefined,
  CONVEX_CLOUD_URL: undefined,
  CONVEX_DEPLOYMENT_TOKEN: undefined,
  CONVEX_DEPLOYMENT: undefined,
  CONVEX_SELF_HOSTED_ADMIN_KEY: undefined,
  CONVEX_SELF_HOSTED_URL: undefined,
  CONVEX_SITE_URL: undefined,
  CONVEX_URL: undefined,
  NETLIFY: undefined,
  VERCEL: undefined,
  VERCEL_ENV: undefined,
  VITE_CONVEX_SITE_URL: undefined,
  VITE_CONVEX_URL: undefined,
  WORKERS_CI: undefined,
};

const reservePort = Effect.fn("contentAcceptance.reservePort")(function* (
  url: string
) {
  const server = yield* Effect.acquireRelease(
    Effect.sync(() => createServer()),
    (socket) =>
      Effect.callback<void>((resume) => {
        if (!socket.listening) {
          resume(Effect.void);
          return;
        }
        socket.close(() => resume(Effect.void));
      })
  );
  yield* Effect.callback<void, ReturnType<typeof acceptanceRuntimeError>>(
    (resume) => {
      server.once("error", () =>
        resume(
          acceptanceRuntimeError(
            `The saved local runtime port at ${url} is occupied; its process is preserved.`
          )
        )
      );
      server.listen(
        { host: "127.0.0.1", port: Number(new URL(url).port) },
        () => resume(Effect.void)
      );
    }
  );
});

/** Preserves listeners that started without this lifecycle's lease. */
export const assertLocalPortsFree = Effect.fn(
  "contentAcceptance.assertLocalPortsFree"
)(function* (runtime: Pick<LocalRuntime, "query" | "site">) {
  yield* reservePort(runtime.query);
  yield* reservePort(runtime.site);
}, Effect.scoped);

/** Owns one local backend until the supplied program finishes, fails, or is interrupted. */
export const withLocalBackend = Effect.fn("contentAcceptance.withLocalBackend")(
  function* <A, E, R>(runtime: LocalRuntime, program: Effect.Effect<A, E, R>) {
    // Refuse occupied ports before Convex can reuse or stop any existing backend.
    yield* assertLocalPortsFree(runtime);
    const fileSystem = yield* FileSystem.FileSystem;
    const logPath = `${runtime.directory}/convex.log`;
    yield* fileSystem.writeFileString(logPath, "", { mode: 0o600 });
    const child = yield* ChildProcess.make(
      "pnpm",
      [
        "exec",
        "convex",
        "dev",
        "--codegen",
        "disable",
        "--typecheck",
        "disable",
        "--tail-logs",
        "always",
      ],
      {
        cwd: runtime.backend,
        env: {
          ...localConvexEnvironment,
          AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
          AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
        },
        extendEnv: true,
        forceKillAfter: "5 seconds",
        stdin: "ignore",
      }
    );
    yield* child.all.pipe(
      Stream.run(fileSystem.sink(logPath, { flag: "a" })),
      Effect.forkScoped
    );
    const ready = Effect.fn("contentAcceptance.waitForBackend")(function* () {
      if (!(yield* child.isRunning)) {
        const detail = sanitizeAcceptanceCommandError(
          yield* fileSystem.readFileString(logPath),
          [runtime.publicationToken]
        );
        return yield* acceptanceRuntimeError(
          `The local Convex process exited before readiness: ${detail}`
        );
      }
      const log = yield* fileSystem.readFileString(logPath);
      if (!log.includes("Convex functions ready!")) {
        return false;
      }
      return yield* Effect.tryPromise({
        try: (signal) => fetch(`${runtime.query}/instance_name`, { signal }),
        catch: () =>
          acceptanceRuntimeError("The local Convex readiness request failed."),
      }).pipe(Effect.map((response) => response.ok));
    });
    yield* ready().pipe(
      Effect.repeat({
        while: (value) => !value,
        schedule: Schedule.spaced("1 second"),
      }),
      Effect.timeoutOrElse({
        duration: "4 minutes",
        orElse: () =>
          acceptanceRuntimeError(
            "The local Convex process did not become ready."
          ),
      })
    );
    return yield* Effect.raceFirst(
      program,
      child.exitCode.pipe(
        Effect.flatMap((code) =>
          acceptanceRuntimeError(
            `The local Convex process exited during the application operation with exit code ${code}.`
          )
        )
      )
    ).pipe(
      Effect.tapCause(() =>
        Effect.gen(function* () {
          const detail = sanitizeAcceptanceCommandError(
            yield* fileSystem.readFileString(logPath),
            [runtime.publicationToken]
          );
          if (detail.length > 0) {
            yield* Effect.logError(
              `Local Convex backend diagnostics: ${detail}`
            );
          }
        }).pipe(
          // Diagnostics must preserve the operation's complete original cause.
          Effect.ignoreCause
        )
      )
    );
  },
  Effect.scoped
);
