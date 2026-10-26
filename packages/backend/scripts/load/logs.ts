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
 * One finished function execution as `convex logs --jsonl --success` prints it: the function and
 * the component it runs in, its kind, how long it ran in seconds, whether a cached result answered
 * it, the documents it read, the write conflict that made Convex run it again, and its error.
 */
const Completion = Schema.Struct({
  cachedResult: Schema.optionalKey(Schema.Boolean),
  componentPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  error: Schema.optionalKey(Schema.NullOr(Schema.String)),
  executionTime: Schema.Finite,
  identifier: Schema.String,
  kind: Schema.Literal("Completion"),
  occInfo: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        tableName: Schema.optionalKey(Schema.NullOr(Schema.String)),
      })
    )
  ),
  udfType: Schema.String,
  usageStats: Schema.Struct({ databaseReadDocuments: Schema.Finite }),
});
type Completion = typeof Completion.Type;

/** Any event of the log stream, which names its kind; only a completion carries a timing. */
const LogEvent = Schema.Struct({ kind: Schema.String });

const decodeEvent = Schema.decodeUnknownOption(Schema.fromJsonString(LogEvent));
const decodeCompletion = Schema.decodeUnknownOption(
  Schema.fromJsonString(Completion)
);

/**
 * What the backend's own log says about a run, as samples by call: how long each execution ran
 * (a cached answer apart, since it runs nothing), the documents each read, and one sample for each
 * write conflict that Convex retried, named by the function and the table it conflicted on.
 */
export interface ServerRun {
  readonly conflicts: readonly Sample[];
  readonly reads: readonly Sample[];
  readonly timings: readonly Sample[];
}

/** The name of an execution's function: its kind, its component, and its path, such as `mutation:exams/sittings:answer`. */
const nameOf = (completion: Completion) =>
  `${Str.toLowerCase(completion.udfType)}:${Option.match(
    Option.fromNullishOr(completion.componentPath),
    { onNone: () => "", onSome: (path) => `${path}/` }
  )}${Str.replace(".js", "")(completion.identifier)}`;

/** Every completion of the log text, in the order the stream printed them. */
const completionsOf = (text: string) =>
  Arr.getSomes(
    Arr.map(Str.split(text, "\n"), (line) =>
      Option.flatMap(decodeEvent(line), (event) =>
        event.kind === "Completion" ? decodeCompletion(line) : Option.none()
      )
    )
  );

/** The backend's own measures of every execution in the log text that `captureLogs` wrote. */
export const serverRun = (text: string): ServerRun => {
  const completions = completionsOf(text);
  const failed = (completion: Completion) =>
    Option.isSome(Option.fromNullishOr(completion.error));
  return {
    conflicts: Arr.getSomes(
      Arr.map(completions, (completion) =>
        Option.map(Option.fromNullishOr(completion.occInfo), (occ) => ({
          failed: true,
          name: `${nameOf(completion)} on ${occ.tableName ?? "an unnamed table"}`,
          value: 1,
        }))
      )
    ),
    reads: Arr.map(completions, (completion) => ({
      failed: failed(completion),
      name: nameOf(completion),
      value: completion.usageStats.databaseReadDocuments,
    })),
    timings: Arr.map(completions, (completion) => ({
      failed: failed(completion),
      name:
        completion.cachedResult === true
          ? `${nameOf(completion)} (cached)`
          : nameOf(completion),
      value: completion.executionTime * 1000,
    })),
  };
};

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
