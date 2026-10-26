import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  localConvexEnvironment,
  makeConvexTemporaryRoot,
} from "@repo/backend/scripts/content/acceptance/process";
import type { Sample } from "@repo/backend/scripts/load/stats";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Schema,
  Stream,
  String as Str,
} from "effect";
import { ChildProcess } from "effect/process";

/**
 * One finished function execution as `convex logs --jsonl --success` prints it: the function,
 * its kind, how long it ran in seconds, and its error when it failed.
 */
const Completion = Schema.Struct({
  error: Schema.optionalKey(Schema.NullOr(Schema.String)),
  executionTime: Schema.Finite,
  identifier: Schema.String,
  kind: Schema.Literal("Completion"),
  udfType: Schema.String,
});

/** Any event of the log stream, which names its kind; only a completion carries a timing. */
const LogEvent = Schema.Struct({ kind: Schema.String });

const decodeEvent = Schema.decodeUnknownOption(Schema.fromJsonString(LogEvent));
const decodeCompletion = Schema.decodeUnknownOption(
  Schema.fromJsonString(Completion)
);

/**
 * The server's own timing of every function execution in the log text, one sample per
 * completion, named by the function's kind and path, such as `mutation:exams/sittings:answer`.
 * A line that is not a completion is a log line or a failure report, which carries no timing.
 */
export const serverSamples = (text: string): readonly Sample[] =>
  Arr.getSomes(
    Arr.map(Str.split(text, "\n"), (line) =>
      Option.flatMap(decodeEvent(line), (event) =>
        event.kind === "Completion"
          ? Option.map(decodeCompletion(line), (completion) => ({
              failed:
                completion.error !== undefined && completion.error !== null,
              ms: completion.executionTime * 1000,
              name: `${Str.toLowerCase(completion.udfType)}:${Str.replace(".js", "")(completion.identifier)}`,
            }))
          : Option.none()
      )
    )
  );

/**
 * Streams the local backend's function log into `path` for as long as the scope lasts, every
 * successful execution included, through the Convex CLI of the runtime, which holds the
 * local deployment's own key. The stream stops with the scope.
 */
export const captureLogs = Effect.fn("load.logs.capture")(function* (
  runtime: Pick<LocalRuntime, "backend">,
  path: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  yield* fileSystem.writeFileString(path, "", { mode: 0o600 });
  const temporaryRoot = yield* makeConvexTemporaryRoot();
  const child = yield* ChildProcess.make(
    process.execPath,
    ["node_modules/convex/bin/main.js", "logs", "--jsonl", "--success"],
    {
      cwd: runtime.backend,
      env: { ...localConvexEnvironment, TMPDIR: temporaryRoot },
      extendEnv: true,
      forceKillAfter: "5 seconds",
      stdin: "ignore",
    }
  );
  yield* child.stdout.pipe(
    Stream.run(fileSystem.sink(path, { flag: "a" })),
    Effect.forkScoped
  );
});
