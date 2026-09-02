import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/scripts/content/runtime/ci/config";
import {
  contentRuntimeCiError,
  sanitizeRuntimeCommandError,
} from "@repo/backend/scripts/content/runtime/ci/error";
import { collectConvexTableRows } from "@repo/backend/scripts/content/runtime/ci/pagination";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

export { sanitizeRuntimeCommandError };

const SHARED_OUTPUT_REDIRECT =
  'output_path=$1; shift; exec "$@" >| "$output_path" 2>&1';
const SPLIT_OUTPUT_REDIRECT =
  'stdout_path=$1; stderr_path=$2; shift 2; exec "$@" >| "$stdout_path" 2>| "$stderr_path"';
const CONVEX_TABLE_DATA_QUERY = makeFunctionReference<
  "query",
  {
    order: "asc" | "desc";
    paginationOpts: {
      cursor: null | string;
      numItems: number;
    };
    table: string;
  },
  unknown
>("_system/cli/tableData");

interface RuntimeCommand {
  readonly args: readonly string[];
  readonly command: string;
  readonly deployKey?: string;
  readonly operation: string;
  readonly reportStderr?: boolean;
  readonly sensitiveValues?: readonly string[];
  readonly stderrPath: string;
  readonly stdin?: string;
  readonly stdoutPath: string;
}

/**
 * Authenticates the HTTP client for Convex's CLI-only system query.
 * Convex strips internal methods from its public declarations, so this runtime
 * capability is validated before any production read is attempted.
 */
const setConvexAdminAuth = Effect.fn("contentRuntime.setConvexAdminAuth")(
  function* (client: ConvexHttpClient, deployKey: string) {
    const authenticate: unknown = Reflect.get(client, "setAdminAuth");
    if (typeof authenticate !== "function") {
      return yield* contentRuntimeCiError(
        "Convex HTTP client does not expose admin authentication."
      );
    }
    yield* Effect.sync(() => Reflect.apply(authenticate, client, [deployKey]));
  }
);

/**
 * Runs one runtime command with mode-600 output captured at process startup.
 * Paths and arguments stay positional so the shell never reparses them.
 * @see https://github.com/Effect-TS/effect/blob/66114151c2b4640bf773f2b3456ce70d679422f6/packages/effect/src/unstable/process/ChildProcess.ts
 * @see https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_07
 */
export const runRuntimeCommand = Effect.fn("contentRuntime.runCommand")(
  function* (spec: RuntimeCommand) {
    const fileSystem = yield* FileSystem.FileSystem;
    const sharedOutput = spec.stdoutPath === spec.stderrPath;

    yield* fileSystem.writeFileString(spec.stdoutPath, "", { mode: 0o600 });
    yield* fileSystem.chmod(spec.stdoutPath, 0o600);
    if (!sharedOutput) {
      yield* fileSystem.writeFileString(spec.stderrPath, "", { mode: 0o600 });
      yield* fileSystem.chmod(spec.stderrPath, 0o600);
    }

    const redirectScript = sharedOutput
      ? SHARED_OUTPUT_REDIRECT
      : SPLIT_OUTPUT_REDIRECT;
    const outputPaths = sharedOutput
      ? [spec.stdoutPath]
      : [spec.stdoutPath, spec.stderrPath];
    const stdin =
      spec.stdin === undefined
        ? "ignore"
        : Stream.succeed(new TextEncoder().encode(spec.stdin));
    const command = ChildProcess.make(
      "sh",
      [
        "-c",
        redirectScript,
        "content-runtime-command",
        ...outputPaths,
        spec.command,
        ...spec.args,
      ],
      {
        env: {
          CONTENT_RUNTIME_CACHE_KEY: "",
          CONVEX_DEPLOY_KEY: spec.deployKey ?? "",
          CONVEX_DEPLOYMENT_TOKEN: "",
        },
        extendEnv: true,
        stderr: "ignore",
        stdin,
        stdout: "ignore",
      }
    );
    const childProcess = yield* command;
    const exitCode = yield* childProcess.exitCode;
    if (exitCode !== 0) {
      if (spec.reportStderr) {
        const stderr = yield* fileSystem.readFileString(spec.stderrPath);
        const detail = sanitizeRuntimeCommandError(
          stderr,
          spec.sensitiveValues ?? []
        );

        if (detail.length > 0) {
          return yield* contentRuntimeCiError(
            `${spec.operation} failed: ${detail}`
          );
        }
      }

      return yield* contentRuntimeCiError(`${spec.operation} failed.`);
    }
  }
);

export const runConvexData = Effect.fn("contentRuntime.readProductionTable")(
  function* (options: {
    readonly deployKey: string;
    readonly limit: number;
    readonly logPath: string;
    readonly outputPath: string;
    readonly table: string;
  }) {
    const fileSystem = yield* FileSystem.FileSystem;
    const outputPaths = new Set([options.logPath, options.outputPath]);

    for (const path of outputPaths) {
      yield* fileSystem.writeFileString(path, "", { mode: 0o600 });
      yield* fileSystem.chmod(path, 0o600);
    }

    const client = new ConvexHttpClient(
      `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`,
      { logger: false }
    );
    yield* setConvexAdminAuth(client, options.deployKey);

    const rows = yield* collectConvexTableRows({
      limit: options.limit,
      readPage: ({ cursor, numItems }) =>
        client.query(CONVEX_TABLE_DATA_QUERY, {
          order: "desc",
          paginationOpts: { cursor, numItems },
          table: options.table,
        }),
      sensitiveValues: [options.deployKey],
      table: options.table,
    }).pipe(Effect.ensuring(Effect.sync(() => client.clearAuth())));

    yield* fileSystem.writeFileString(options.outputPath, JSON.stringify(rows), {
      mode: 0o600,
    });
    yield* fileSystem.chmod(options.outputPath, 0o600);
  }
);

export const runConvexImport = Effect.fn("contentRuntime.importLocalTable")(
  function* (options: {
    readonly inputPath: string;
    readonly logPath: string;
    readonly table: string;
  }) {
    yield* runRuntimeCommand({
      args: [
        "exec",
        "convex",
        "import",
        "--format",
        "jsonLines",
        "--table",
        options.table,
        "--replace",
        "--yes",
        options.inputPath,
      ],
      command: "pnpm",
      operation: `Local import for ${options.table}`,
      stderrPath: options.logPath,
      stdoutPath: options.logPath,
    });
  }
);
