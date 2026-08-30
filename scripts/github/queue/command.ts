import { Effect, type PlatformError, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { queueGateError } from "#scripts/github/queue/admission";

const collectText = (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );

/** Runs one external command for exact merge-queue verification. */
export const runCommand = Effect.fn("QueueGate.runCommand")(function* (
  workingDirectory: string,
  executable: string,
  args: readonly string[],
  options: {
    readonly env?: Readonly<Record<string, string>>;
  } = {}
) {
  const command = yield* ChildProcess.make(executable, args, {
    cwd: workingDirectory,
    env: options.env,
    extendEnv: options.env !== undefined,
  }).pipe(
    Effect.mapError((cause) =>
      queueGateError(`Unable to start ${executable} verification.`, cause)
    )
  );
  const [exitCode, stdout, stderr] = yield* Effect.all(
    [
      command.exitCode,
      collectText(command.stdout),
      collectText(command.stderr),
    ],
    { concurrency: 3 }
  ).pipe(
    Effect.mapError((cause) =>
      queueGateError(`Unable to read ${executable} verification.`, cause)
    )
  );
  if (exitCode !== 0) {
    return yield* queueGateError(
      `${executable} verification failed: ${stderr.trim() || "unknown command error"}.`
    );
  }
  return stdout;
});
