import { NodeSocketServer } from "@effect/platform-node";
import {
  acceptanceRuntimeError,
  retryVersionServiceStart,
  sanitizeAcceptanceCommandError,
} from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Effect, Exit, FileSystem, Schedule, Scope, Stream } from "effect";
import { HttpClient } from "effect/http";
import { ChildProcess } from "effect/process";

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
  NAKAFA_DEPLOY_STAGE: undefined,
  NETLIFY: undefined,
  VITE_CONVEX_SITE_URL: undefined,
  VITE_CONVEX_URL: undefined,
  WORKERS_CI: undefined,
};

const reservePort = Effect.fn("contentAcceptance.reservePort")(function* (
  url: string
) {
  yield* NodeSocketServer.make({
    host: "127.0.0.1",
    port: Number(new URL(url).port),
  }).pipe(
    Effect.mapError(() =>
      acceptanceRuntimeError(
        `The saved local runtime port at ${url} is occupied; its process is preserved.`
      )
    )
  );
});

/** Preserves listeners that started without this lifecycle's lease. */
export const assertLocalPortsFree = Effect.fn(
  "contentAcceptance.assertLocalPortsFree"
)(function* (runtime: Pick<LocalRuntime, "query" | "site">) {
  yield* reservePort(runtime.query);
  yield* reservePort(runtime.site);
}, Effect.scoped);

/**
 * Convex caps active isolates so functions never oversubscribe the CPU. The
 * local backend leaves that cap unlimited, so a prerender burst runs dozens of
 * isolates on a few cores and queries exhaust their one-second user time while
 * waiting for CPU. Waiting for an isolate permit does not count as user time.
 *
 * The cap covers only this backend's own isolates. On a machine that also runs
 * other builds and browsers, a query still waits for CPU while it holds its
 * permit, so the local user time limit of queries and mutations is five
 * seconds instead of the one second a cloud deployment gives them.
 *
 * The same contention stretches the start. Each start pushes every function,
 * and the backend analyzes the pushed modules within four seconds: on a busy
 * machine the analysis outlasts them and the push fails ("Loading the pushed
 * modules encountered the following error: Function execution timed out
 * (maximum duration: 4s)"), so the local analysis gets thirty. The Convex CLI
 * waits thirty seconds for the backend's own process to answer before it
 * pushes, which a swapping machine also outlasts, so it waits two minutes.
 * A cloud deployment keeps its own limits for every real deploy.
 * @see https://github.com/get-convex/convex-backend/blob/main/crates/isolate/src/concurrency_limiter.rs
 * @see https://github.com/get-convex/convex-backend/blob/main/crates/isolate/src/timeout.rs
 * @see https://github.com/get-convex/convex-backend/blob/main/crates/common/src/knobs.rs
 * @see https://github.com/get-convex/convex-js/blob/main/src/cli/lib/localDeployment/run.ts
 */
const localBackendEnvironment = {
  CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS: "120",
  DATABASE_UDF_USER_TIMEOUT_SECONDS: "5",
  FUNRUN_ISOLATE_ACTIVE_THREADS: String(navigator.hardwareConcurrency),
  ISOLATE_ANALYZE_USER_TIMEOUT_SECONDS: "30",
};

/**
 * How many queries, mutations and Convex runtime actions, HTTP actions included, the deployment
 * class of production's Professional plan (S256) runs at once before more wait. The local backend
 * starts with the Free plan's S16, which suits a browser suite; a run that measures production's
 * latency under many clients, such as the load test, starts its backend with these instead.
 * @see https://docs.convex.dev/production/state/limits
 */
export const PRODUCTION_CONCURRENCY = {
  APPLICATION_MAX_CONCURRENT_MUTATIONS: "256",
  APPLICATION_MAX_CONCURRENT_QUERIES: "256",
  APPLICATION_MAX_CONCURRENT_V8_ACTIONS: "512",
};

/**
 * How long a start may take before its backend answers: the push of every
 * function took 2.94 minutes at a load of about 40 on 11 cores (25 Oct 2026),
 * and longer while the machine swapped, so a start gets ten minutes.
 */
const BACKEND_READY_TIMEOUT = "10 minutes";

/**
 * Scopes a private temporary root to one Convex process group.
 *
 * The local backend deletes its Node executor directory only when Ctrl-C stops
 * it, yet this runner and the Convex CLI both stop it with SIGTERM, so every
 * backend would leave that directory in the shared system temporary folder.
 * Acquired before the group, the root is removed only after the group stops.
 * It stays in the short system folder because the executor's Unix socket path
 * must fit in 104 bytes on macOS.
 * @see https://github.com/get-convex/convex-js/blob/main/src/cli/lib/localDeployment/run.ts
 */
export const makeConvexTemporaryRoot = Effect.fn(
  "contentAcceptance.makeConvexTemporaryRoot"
)(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.makeTempDirectoryScoped({ prefix: "convex-" });
});

/** Starts the local backend in the scope it is given and returns it once it answers. */
const startLocalBackend = Effect.fn("contentAcceptance.startLocalBackend")(
  function* (
    runtime: LocalRuntime,
    logPath: string,
    concurrency: Partial<typeof PRODUCTION_CONCURRENCY>
  ) {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.writeFileString(logPath, "", { mode: 0o600 });
    const temporaryRoot = yield* makeConvexTemporaryRoot();
    const child = yield* ChildProcess.make(
      process.execPath,
      [
        "node_modules/convex/bin/main.js",
        "dev",
        "--codegen",
        "enable",
        "--typecheck",
        "disable",
        "--tail-logs",
        "always",
      ],
      {
        cwd: runtime.backend,
        env: {
          ...localConvexEnvironment,
          ...localBackendEnvironment,
          ...concurrency,
          AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
          AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
          TMPDIR: temporaryRoot,
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
    const client = yield* HttpClient.HttpClient;
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
      return yield* client.get(`${runtime.query}/instance_name`).pipe(
        Effect.map(
          (response) => response.status >= 200 && response.status < 300
        ),
        Effect.mapError(() =>
          acceptanceRuntimeError("The local Convex readiness request failed.")
        )
      );
    });
    yield* ready().pipe(
      Effect.repeat({
        while: (value) => !value,
        schedule: Schedule.spaced("1 second"),
      }),
      Effect.timeoutOrElse({
        duration: BACKEND_READY_TIMEOUT,
        orElse: () =>
          acceptanceRuntimeError(
            "The local Convex process did not become ready."
          ),
      })
    );
    return child;
  }
);

/** A failed start releases its own scope before a retry; a started backend keeps it. */
const startLocalBackendAttempt = Effect.fn(
  "contentAcceptance.startLocalBackendAttempt"
)(function* (
  runtime: LocalRuntime,
  logPath: string,
  concurrency: Partial<typeof PRODUCTION_CONCURRENCY>
) {
  const attempt = yield* Scope.fork(yield* Effect.scope);
  return yield* startLocalBackend(runtime, logPath, concurrency).pipe(
    Effect.provideService(Scope.Scope, attempt),
    Effect.onExitIf(Exit.isFailure, (exit) => Scope.close(attempt, exit))
  );
});

/**
 * Refreshes Convex bindings and owns the local backend through application acceptance. The
 * backend runs with the local concurrency unless the caller asks for more, such as
 * `PRODUCTION_CONCURRENCY`.
 */
export const withLocalBackend = Effect.fn("contentAcceptance.withLocalBackend")(
  function* <A, E, R>(
    runtime: LocalRuntime,
    program: Effect.Effect<A, E, R>,
    concurrency: Partial<typeof PRODUCTION_CONCURRENCY> = {}
  ) {
    // Refuse occupied ports before Convex can reuse or stop any existing backend.
    yield* assertLocalPortsFree(runtime);
    const fileSystem = yield* FileSystem.FileSystem;
    const logPath = `${runtime.directory}/convex.log`;
    const child = yield* retryVersionServiceStart(
      startLocalBackendAttempt(runtime, logPath, concurrency)
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
