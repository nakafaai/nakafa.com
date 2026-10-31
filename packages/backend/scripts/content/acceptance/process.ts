import { NodeSocketServer } from "@effect/platform-node";
import {
  deployFunctions,
  LocalDeploymentJson,
} from "@repo/backend/scripts/content/acceptance/deployment";
import {
  acceptanceRuntimeError,
  sanitizeAcceptanceCommandError,
} from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Config, Effect, FileSystem, Schedule, Schema, Stream } from "effect";
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
 * (maximum duration: 4s)"), so the local analysis gets thirty. A cloud
 * deployment keeps its own limits for every real deploy.
 * @see https://github.com/get-convex/convex-backend/blob/main/crates/isolate/src/concurrency_limiter.rs
 * @see https://github.com/get-convex/convex-backend/blob/main/crates/isolate/src/timeout.rs
 * @see https://github.com/get-convex/convex-backend/blob/main/crates/common/src/knobs.rs
 */
const localBackendEnvironment = {
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

/**
 * Runs the backend binary that `convex init` downloaded, on the state it saved, and pushes the
 * functions once from `packages/backend`. `convex dev` cannot do either from the runtime's folder:
 * it marks a package external only when `<cwd>/node_modules/<name>` is the same path the importer
 * resolves, so from here it bundles the PDF renderer, whose engine no bundle can load. From the
 * package it would select this deployment by erasing `CONVEX_DEPLOYMENT` from that checkout's
 * `.env.local`. `convex deploy` writes no such file, and it pushes as production does.
 * @see https://github.com/get-convex/convex-js/blob/main/src/bundler/external.ts
 * @see https://github.com/get-convex/convex-js/blob/main/src/cli/lib/localDeployment/run.ts
 * @see https://github.com/get-convex/convex-js/blob/main/src/cli/configure.ts
 */
const startLocalBackend = Effect.fn("contentAcceptance.startLocalBackend")(
  function* (
    runtime: LocalRuntime,
    logPath: string,
    concurrency: Partial<typeof PRODUCTION_CONCURRENCY>
  ) {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.writeFileString(logPath, "", { mode: 0o600 });
    const state = `${runtime.backend}/.convex/local/default`;
    const deployment = yield* fileSystem
      .readFileString(`${state}/config.json`)
      .pipe(Effect.flatMap(Schema.decodeEffect(LocalDeploymentJson)));
    const home = yield* Config.schema(Schema.NonEmptyString, "HOME").pipe(
      Effect.orDie
    );
    const environment = {
      ...localConvexEnvironment,
      ...localBackendEnvironment,
      ...concurrency,
      AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
      TMPDIR: yield* makeConvexTemporaryRoot(),
    };
    const child = yield* ChildProcess.make(
      `${home}/.cache/convex/binaries/${deployment.backendVersion}/convex-local-backend`,
      [
        "--port",
        String(deployment.ports.cloud),
        "--site-proxy-port",
        String(deployment.ports.site),
        "--instance-name",
        deployment.deploymentName,
        "--instance-secret",
        deployment.instanceSecret,
        "--local-storage",
        `${state}/convex_local_storage`,
        "--local-log-sink",
        `${runtime.directory}/functions.log`,
        "--disable-beacon",
        `${state}/convex_local_backend.sqlite3`,
      ],
      {
        cwd: runtime.backend,
        env: environment,
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
      return yield* client.get(`${runtime.query}/instance_name`).pipe(
        Effect.flatMap((response) => response.text),
        Effect.map((name) => name === deployment.deploymentName),
        // The backend refuses connections until it listens.
        Effect.orElseSucceed(() => false)
      );
    });
    yield* ready().pipe(
      Effect.repeat({
        while: (value) => !value,
        schedule: Schedule.spaced("1 second"),
      }),
      Effect.andThen(
        deployFunctions(runtime, deployment, environment, logPath)
      ),
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
    const child = yield* startLocalBackend(runtime, logPath, concurrency);
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
