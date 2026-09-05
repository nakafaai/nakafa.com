import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  isProtectedProduction,
} from "@repo/backend/content/deployment";
import { runRuntimeCommand } from "@repo/backend/scripts/content/runtime/ci/command";
import {
  readExportConfig,
  readImportConfig,
  readProductionConfig,
} from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import {
  readProductionGenerations,
  verifyRuntimeSelection,
} from "@repo/backend/scripts/content/runtime/ci/generation";
import { importSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/import";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import {
  initializeLocalRuntime,
  LOCAL_RUNTIME_TOKEN,
  leaseLocalRuntime,
  localApplicationEnvironment,
  readLocalRuntime,
  releaseLocalRuntime,
  reserveLocalRuntime,
} from "@repo/backend/scripts/content/runtime/local";
import {
  runBuildCommand,
  withLocalBackend,
} from "@repo/backend/scripts/content/runtime/process";
import { readContentRuntimeSchemaFingerprint } from "@repo/backend/scripts/content/runtime/tables";
import {
  ConfigProvider,
  Effect,
  Exit,
  FileSystem,
  Result,
  Schema,
} from "effect";

type BuildEnvironment = Readonly<Record<string, string | undefined>>;
const BuildOperation = Schema.Literals(["build", "prepare"]);

const compileApplication = Effect.fn("contentRuntime.compileApplication")(
  function* (
    root: string,
    args: readonly string[],
    app: BuildEnvironment,
    local: BuildEnvironment
  ) {
    yield* runBuildCommand(
      root,
      ["--filter", "www", "verify:featured-renderer"],
      local
    );
    yield* runBuildCommand(root, ["--filter", "www", "typecheck"], app);
    yield* runBuildCommand(
      root,
      ["exec", "turbo", "run", "build", ...args],
      app
    );
  }
);

/** Validates the host before any production read or temporary checkout mutation. */
export const assertBuildHost = Effect.fn("contentRuntime.assertBuildHost")(
  function* (env: BuildEnvironment) {
    if (!env.VERCEL) {
      return false;
    }
    if (
      !isProtectedProduction({
        deployment: env.VERCEL_DEPLOYMENT_ID,
        environment: env.VERCEL_ENV,
        git: {
          branch: env.VERCEL_GIT_COMMIT_REF,
          commit: env.VERCEL_GIT_COMMIT_SHA,
          owner: env.VERCEL_GIT_REPO_OWNER,
          provider: env.VERCEL_GIT_PROVIDER,
          repository: env.VERCEL_GIT_REPO_SLUG,
        },
        marker: env.VERCEL,
        project: env.VERCEL_PROJECT_ID,
        target: env.VERCEL_TARGET_ENV,
      }) ||
      env.NEXT_PUBLIC_CONVEX_URL !==
        `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud` ||
      env.VITE_CONVEX_SITE_URL !==
        `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.site`
    ) {
      return yield* contentRuntimeCiError(
        "Snapshot builds require the protected Vercel identity and Convex deploy --cmd production URLs."
      );
    }
    return true;
  }
);

/** Downloads the exact shared encrypted snapshot, exporting only when it is unavailable. */
const acquireSnapshot = Effect.fn("contentRuntime.acquireSnapshot")(function* (
  config: Effect.Success<typeof readExportConfig>
) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${config.runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
  const target = `${directory}/${CONTENT_RUNTIME_CACHE_FILE}`;
  yield* fs.makeDirectory(directory, { mode: 0o700 });
  yield* fs.writeFileString(target, "", { mode: 0o600 });
  const asset = `snapshot.${config.runtimeSelectionHash}.${config.runtimeSchemaFingerprint}.gpg`;
  const downloaded = yield* runRuntimeCommand({
    command: "curl",
    args: [
      "--fail",
      "--location",
      "--silent",
      "--show-error",
      "--retry",
      "5",
      "--retry-all-errors",
      "--retry-delay",
      "2",
      `https://github.com/nakafaai/nakafa.com/releases/download/runtime/${asset}`,
      "--output",
      target,
    ],
    operation: "Signed snapshot download",
    stdoutPath: `${config.runnerTemp}/download.log`,
    stderrPath: `${config.runnerTemp}/download.log`,
  }).pipe(Effect.result);
  if (Result.isFailure(downloaded) || (yield* fs.stat(target)).size === 0n) {
    yield* fs.remove(target);
    yield* exportSignedRuntime(config);
  }
});

/** Builds once with the configured development runtime or one owned signed snapshot. */
export const buildApplication = Effect.fn("contentRuntime.buildApplication")(
  function* (
    root: string,
    args: readonly string[],
    env: BuildEnvironment,
    operation: typeof BuildOperation.Type = "build"
  ) {
    const vercel = yield* assertBuildHost(env);
    if (!(vercel || env.CONTENT_RUNTIME_SNAPSHOT) && operation === "build") {
      const runtime = yield* readLocalRuntime(root);
      if (runtime) {
        yield* leaseLocalRuntime(root);
        return yield* withLocalBackend(
          runtime,
          compileApplication(
            root,
            args,
            localApplicationEnvironment(runtime),
            localApplicationEnvironment(runtime)
          )
        );
      }
      if (env.CONTENT_RUNTIME_BUILD !== "local-static") {
        return yield* runBuildCommand(root, [
          "exec",
          "turbo",
          "run",
          "build",
          ...args,
        ]);
      }
    }
    if (vercel && env.CONTENT_RUNTIME_SNAPSHOT) {
      return yield* contentRuntimeCiError(
        "Protected Vercel builds must select the current production snapshot."
      );
    }
    const fs = yield* FileSystem.FileSystem;
    const reservation = yield* reserveLocalRuntime(root);
    const directory = reservation.directory;
    return yield* Effect.gen(function* () {
      yield* leaseLocalRuntime(root);
      if (vercel) {
        // Vercel's Amazon Linux image ships signature-only GnuPG.
        // https://docs.aws.amazon.com/linux/al2023/ug/gnupg-minimal.html
        yield* runRuntimeCommand({
          command: "dnf",
          args: ["swap", "--assumeyes", "gnupg2-minimal", "gnupg2-full"],
          operation: "Vercel authenticated encryption support",
          stderrPath: `${directory}/gnupg.log`,
          stdoutPath: `${directory}/gnupg.log`,
        });
      }
      const runtimeSchemaFingerprint =
        yield* readContentRuntimeSchemaFingerprint();
      const provider = {
        ...env,
        RUNNER_TEMP: directory,
        CONTENT_RUNTIME_SCHEMA_HASH: runtimeSchemaFingerprint,
      };
      const source = yield* Effect.gen(function* () {
        if (env.CONTENT_RUNTIME_SNAPSHOT) {
          const config = yield* readImportConfig.pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnvRecord(provider)
            )
          );
          const target = `${directory}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
          yield* fs.makeDirectory(target, { mode: 0o700 });
          yield* fs.copyFile(
            env.CONTENT_RUNTIME_SNAPSHOT,
            `${target}/${CONTENT_RUNTIME_CACHE_FILE}`
          );
          yield* fs.chmod(`${target}/${CONTENT_RUNTIME_CACHE_FILE}`, 0o600);
          return { config, verify: Effect.void };
        }
        const production = yield* readProductionConfig.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(provider)
          )
        );
        const selection = yield* readProductionGenerations(production);
        const config = yield* readExportConfig.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({
              ...provider,
              CONTENT_RUNTIME_SELECTION_HASH: selection.runtimeSelectionHash,
            })
          )
        );
        const verify = readProductionGenerations(config).pipe(
          Effect.flatMap((actual) => verifyRuntimeSelection(config, actual))
        );
        yield* verify;
        yield* acquireSnapshot(config);
        return { config, verify };
      });
      const runtime = yield* initializeLocalRuntime(root, source.config);
      return yield* withLocalBackend(
        runtime,
        Effect.gen(function* () {
          yield* importSignedRuntime(source.config, runtime.backend);
          const local = localApplicationEnvironment(runtime);
          const appEnvironment = vercel
            ? {
                CONTENT_BUILD_SITE_URL: runtime.site,
                CONTENT_BUILD_URL: runtime.query,
                CONVEX_AGENT_MODE: undefined,
                CONTENT_RUNTIME_TOKEN: LOCAL_RUNTIME_TOKEN,
                NEXT_PUBLIC_CONVEX_URL: env.NEXT_PUBLIC_CONVEX_URL,
                NEXT_PUBLIC_CONVEX_SITE_URL: env.VITE_CONVEX_SITE_URL,
                TURBO_CONCURRENCY: env.TURBO_CONCURRENCY ?? "2",
              }
            : local;
          if (operation === "build") {
            yield* compileApplication(root, args, appEnvironment, local);
          }
          yield* source.verify;
          if (env.GITHUB_OUTPUT) {
            yield* fs.writeFileString(
              env.GITHUB_OUTPUT,
              `CONTENT_RUNTIME_SELECTION_HASH=${source.config.runtimeSelectionHash}\n`,
              { flag: "a" }
            );
          }
          // The database remains for root start; the acquired ciphertext does not.
          yield* fs.remove(`${directory}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`, {
            recursive: true,
          });
        })
      );
    }).pipe(
      Effect.scoped,
      Effect.onExit((exit) =>
        vercel || Exit.isFailure(exit)
          ? releaseLocalRuntime(reservation)
          : Effect.void
      )
    );
  }
);

/** Starts the existing build and reopens its owned local database without rebuilding. */
export const startApplication = Effect.fn("contentRuntime.startApplication")(
  function* (root: string, args: readonly string[]) {
    const runtime = yield* readLocalRuntime(root);
    if (!runtime) {
      return yield* runBuildCommand(root, [
        "exec",
        "turbo",
        "run",
        "start",
        ...args,
      ]);
    }
    yield* leaseLocalRuntime(root);
    yield* withLocalBackend(
      runtime,
      runBuildCommand(
        root,
        ["exec", "turbo", "run", "start", ...args],
        localApplicationEnvironment(runtime)
      )
    );
  }
);
