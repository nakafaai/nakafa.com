import { createServer } from "node:net";
import {
  contentRuntimeCiError,
  sanitizeRuntimeCommandError,
} from "@repo/backend/scripts/content/runtime/ci/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/runtime/local";
import { readContentRuntimeSchemaFingerprint } from "@repo/backend/scripts/content/runtime/tables";
import { Effect, FileSystem, Schedule, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

/** Runs build tools without forwarding credentials reserved for snapshot acquisition. */
export const runBuildCommand = Effect.fn("contentRuntime.runBuildCommand")(
  function* (
    cwd: string,
    args: readonly string[],
    env: Readonly<Record<string, string | undefined>> = {}
  ) {
    const child = yield* ChildProcess.make("pnpm", args, {
      cwd,
      env: {
        ...env,
        CONTENT_RUNTIME_CACHE_KEY: undefined,
        CONVEX_DEPLOY_KEY: undefined,
        CONVEX_DEPLOYMENT_TOKEN: undefined,
      },
      extendEnv: true,
      forceKillAfter: "5 seconds",
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = yield* child.exitCode;
    if (code !== 0) {
      return yield* contentRuntimeCiError(
        `pnpm ${args.join(" ")} failed with exit code ${code}.`
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
  CONTENT_RUNTIME_CACHE_KEY: undefined,
  CONVEX_AGENT_MODE: "anonymous",
  CONVEX_DEPLOY_KEY: undefined,
  CONVEX_DEPLOYMENT_TOKEN: undefined,
  CONVEX_DEPLOYMENT: undefined,
  CONVEX_SELF_HOSTED_ADMIN_KEY: undefined,
  CONVEX_SELF_HOSTED_URL: undefined,
  CONVEX_SITE_URL: undefined,
  CONVEX_URL: undefined,
  NETLIFY: undefined,
  VERCEL: undefined,
  VITE_CONVEX_SITE_URL: undefined,
  VITE_CONVEX_URL: undefined,
  WORKERS_CI: undefined,
};

const reservePort = Effect.fn("contentRuntime.reservePort")(function* (
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
  yield* Effect.callback<void, ReturnType<typeof contentRuntimeCiError>>(
    (resume) => {
      server.once("error", () =>
        resume(
          contentRuntimeCiError(
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
  "contentRuntime.assertLocalPortsFree"
)(function* (runtime: Pick<LocalRuntime, "query" | "site">) {
  yield* reservePort(runtime.query);
  yield* reservePort(runtime.site);
}, Effect.scoped);

/** Owns one local backend until the supplied program finishes, fails, or is interrupted. */
export const withLocalBackend = Effect.fn("contentRuntime.withLocalBackend")(
  function* <A, E, R>(runtime: LocalRuntime, program: Effect.Effect<A, E, R>) {
    if (
      runtime.runtimeSchemaFingerprint !==
      (yield* readContentRuntimeSchemaFingerprint())
    ) {
      return yield* contentRuntimeCiError(
        "The prepared snapshot schema changed. Run pnpm runtime:clean and prepare the matching snapshot before building or starting."
      );
    }
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
        env: localConvexEnvironment,
        extendEnv: true,
        forceKillAfter: "5 seconds",
        stdin: "ignore",
      }
    );
    yield* child.all.pipe(
      Stream.run(fileSystem.sink(logPath, { flag: "a" })),
      Effect.forkScoped
    );
    const ready = Effect.fn("contentRuntime.waitForBackend")(function* () {
      if (!(yield* child.isRunning)) {
        const detail = sanitizeRuntimeCommandError(
          yield* fileSystem.readFileString(logPath),
          []
        );
        return yield* contentRuntimeCiError(
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
          contentRuntimeCiError("The local Convex readiness request failed."),
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
          contentRuntimeCiError(
            "The local Convex process did not become ready."
          ),
      })
    );
    return yield* Effect.raceFirst(
      program,
      child.exitCode.pipe(
        Effect.flatMap((code) =>
          contentRuntimeCiError(
            `The local Convex process exited during the application operation with exit code ${code}.`
          )
        )
      )
    );
  },
  Effect.scoped
);
