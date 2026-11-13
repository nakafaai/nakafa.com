import { Effect, type PlatformError, Stream } from "effect";
import { ChildProcess } from "effect/process";

/** Collects one child-process stream as UTF-8 text. */
export function collectText(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );
}

/**
 * Runs one command without a shell and returns how it exited and what it
 * printed. A caller decides what a non-zero exit means.
 */
export const runText = Effect.fn("RepositoryPolicy.runText")(function* (
  command: string,
  args: readonly string[],
  cwd?: string
) {
  const child = yield* ChildProcess.make(command, args, {
    ...(cwd === undefined ? {} : { cwd }),
    stdin: "ignore",
  });
  const [code, stdout, stderr] = yield* Effect.all(
    [child.exitCode, collectText(child.stdout), collectText(child.stderr)],
    { concurrency: "unbounded" }
  );
  return { code: Number(code), stdout, stderr };
}, Effect.scoped);
