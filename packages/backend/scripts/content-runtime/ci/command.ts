import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import stripAnsi from "strip-ansi";
import { contentRuntimeCiError } from "./error";

const MAX_COMMAND_ERROR_LENGTH = 500;
const WHITESPACE = /\s+/u;
const SHARED_OUTPUT_REDIRECT =
  'output_path=$1; shift; exec "$@" >| "$output_path" 2>&1';
const SPLIT_OUTPUT_REDIRECT =
  'stdout_path=$1; stderr_path=$2; shift 2; exec "$@" >| "$stdout_path" 2>| "$stderr_path"';

export const sanitizeRuntimeCommandError = (
  text: string,
  sensitiveValues: readonly string[]
) => {
  let sanitized = stripAnsi(text);

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue.length > 0) {
      sanitized = sanitized.replaceAll(sensitiveValue, "[redacted]");
    }
  }

  return sanitized
    .trim()
    .split(WHITESPACE)
    .join(" ")
    .slice(0, MAX_COMMAND_ERROR_LENGTH);
};

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
 * Runs one runtime command with mode-600 output captured at process startup.
 * Paths and arguments stay positional so the shell never reparses them.
 * @see https://www.effect.website/docs/v3/platform/command
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
          AGENT_DOCS_CONTENT_CACHE_KEY: "",
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
    yield* runRuntimeCommand({
      args: [
        "exec",
        "convex",
        "data",
        options.table,
        "--limit",
        String(options.limit),
        "--format",
        "jsonArray",
      ],
      command: "pnpm",
      deployKey: options.deployKey,
      operation: `Production read for ${options.table}`,
      reportStderr: true,
      sensitiveValues: [options.deployKey],
      stderrPath: options.logPath,
      stdoutPath: options.outputPath,
    });
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
