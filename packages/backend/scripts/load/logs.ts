import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  localConvexEnvironment,
  makeConvexTemporaryRoot,
} from "@repo/backend/scripts/content/acceptance/process";
import { Sample } from "@repo/backend/scripts/load/stats";
import {
  Effect,
  FileSystem,
  MutableList,
  Option,
  Schema,
  String as Str,
  Stream,
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
const ServerRun = Schema.Struct({
  conflicts: Schema.Array(Sample),
  reads: Schema.Array(Sample),
  timings: Schema.Array(Sample),
});

/** The name of an execution's function: its kind, its component, and its path, such as `mutation:exams/sittings:answer`. */
const nameOf = (completion: Completion) =>
  `${Str.toLowerCase(completion.udfType)}:${Option.match(
    Option.fromNullishOr(completion.componentPath),
    { onNone: () => "", onSome: (path) => `${path}/` }
  )}${Str.replace(".js", "")(completion.identifier)}`;

/** The completion that one line of the log stream prints, or none for any other line. */
const completionOf = (line: string) =>
  Option.flatMap(decodeEvent(line), (event) =>
    event.kind === "Completion" ? decodeCompletion(line) : Option.none()
  );

/**
 * The backend's own measures of every execution in the log file that `captureLogs` wrote. The
 * file of a full run holds hundreds of megabytes, so it is read line by line, and only the
 * measures stay in memory.
 */
export const readServerRun = Effect.fn("load.logs.read")(function* (
  path: string
) {
  const conflicts = MutableList.make<Sample>();
  const reads = MutableList.make<Sample>();
  const timings = MutableList.make<Sample>();
  yield* (yield* FileSystem.FileSystem).stream(path).pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.runForEach((line) =>
      Effect.sync(() => {
        const found = completionOf(line);
        if (Option.isNone(found)) {
          return;
        }
        const completion = found.value;
        const name = nameOf(completion);
        const failed = Option.isSome(Option.fromNullishOr(completion.error));
        const occ = Option.fromNullishOr(completion.occInfo);
        if (Option.isSome(occ)) {
          MutableList.append(conflicts, {
            failed: true,
            name: `${name} on ${occ.value.tableName ?? "an unnamed table"}`,
            value: 1,
          });
        }
        MutableList.append(reads, {
          failed,
          name,
          value: completion.usageStats.databaseReadDocuments,
        });
        MutableList.append(timings, {
          failed,
          name: completion.cachedResult === true ? `${name} (cached)` : name,
          value: completion.executionTime * 1000,
        });
      })
    )
  );
  return {
    conflicts: MutableList.toArray(conflicts),
    reads: MutableList.toArray(reads),
    timings: MutableList.toArray(timings),
  } satisfies typeof ServerRun.Type;
});

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
