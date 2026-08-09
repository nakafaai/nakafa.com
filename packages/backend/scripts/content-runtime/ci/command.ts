import { Command, FileSystem } from "@effect/platform";
import { Effect, Stream } from "effect";
import stripAnsi from "strip-ansi";
import { contentRuntimeCiError } from "./error";

const MAX_COMMAND_ERROR_LENGTH = 500;
const WHITESPACE = /\s+/u;

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
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly operation: string;
  readonly reportStderr?: boolean;
  readonly sensitiveValues?: readonly string[];
  readonly stderrPath: string;
  readonly stdin?: string;
  readonly stdoutPath: string;
}

export const runRuntimeCommand = Effect.fn("contentRuntime.runCommand")(
  function* (spec: RuntimeCommand) {
    const fileSystem = yield* FileSystem.FileSystem;
    const sharedOutput = spec.stdoutPath === spec.stderrPath;

    if (sharedOutput) {
      yield* fileSystem.writeFileString(spec.stdoutPath, "", {
        mode: 0o600,
      });
    }

    const outputFlag = sharedOutput ? "a" : "w";
    let command = Command.make(spec.command, ...spec.args);

    if (spec.environment) {
      command = Command.env(command, spec.environment);
    }
    if (spec.stdin !== undefined) {
      command = Command.feed(command, spec.stdin);
    }

    const [exitCode] = yield* Effect.scoped(
      Effect.gen(function* () {
        const process = yield* Command.start(command);

        return yield* Effect.all(
          [
            process.exitCode,
            Stream.run(
              process.stdout,
              fileSystem.sink(spec.stdoutPath, {
                flag: outputFlag,
                mode: 0o600,
              })
            ),
            Stream.run(
              process.stderr,
              fileSystem.sink(spec.stderrPath, {
                flag: outputFlag,
                mode: 0o600,
              })
            ),
          ] as const,
          { concurrency: "unbounded" }
        );
      })
    );
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
      environment: {
        AGENT_DOCS_CONTENT_CACHE_KEY: undefined,
        CONVEX_DEPLOY_KEY: options.deployKey,
      },
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
      environment: {
        AGENT_DOCS_CONTENT_CACHE_KEY: undefined,
        CONVEX_DEPLOY_KEY: undefined,
      },
      operation: `Local import for ${options.table}`,
      stderrPath: options.logPath,
      stdoutPath: options.logPath,
    });
  }
);
