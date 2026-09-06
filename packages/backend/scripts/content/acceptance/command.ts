import {
  acceptanceRuntimeError,
  sanitizeAcceptanceCommandError,
} from "@repo/backend/scripts/content/acceptance/error";
import { localConvexEnvironment } from "@repo/backend/scripts/content/acceptance/process";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const SHARED_OUTPUT_REDIRECT =
  'output_path=$1; shift; exec "$@" >| "$output_path" 2>&1';
const SPLIT_OUTPUT_REDIRECT =
  'stdout_path=$1; stderr_path=$2; shift 2; exec "$@" >| "$stdout_path" 2>| "$stderr_path"';
interface AcceptanceCommand {
  readonly args: readonly string[];
  readonly command: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
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
 * @see https://github.com/Effect-TS/effect/blob/66114151c2b4640bf773f2b3456ce70d679422f6/packages/effect/src/unstable/process/ChildProcess.ts
 * @see https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_07
 */
export const runAcceptanceCommand = Effect.fn("contentAcceptance.runCommand")(
  function* (spec: AcceptanceCommand) {
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
        "content-acceptance-command",
        ...outputPaths,
        spec.command,
        ...spec.args,
      ],
      {
        cwd: spec.cwd,
        env: {
          ...localConvexEnvironment,
          ...spec.env,
          AKSARA_ACCEPTANCE_PRIVATE_KEY:
            spec.env?.AKSARA_ACCEPTANCE_PRIVATE_KEY,
          AKSARA_SIGNING_PRIVATE_KEY: undefined,
          CONVEX_DEPLOY_KEY: undefined,
          CONVEX_DEPLOYMENT_TOKEN: undefined,
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
        const detail = sanitizeAcceptanceCommandError(
          stderr,
          spec.sensitiveValues ?? []
        );

        if (detail.length > 0) {
          return yield* acceptanceRuntimeError(
            `${spec.operation} failed: ${detail}`
          );
        }
      }

      return yield* acceptanceRuntimeError(`${spec.operation} failed.`);
    }
  }
);
