import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { captureLogs, readServerRun } from "@repo/backend/scripts/load/logs";
import {
  Array as Arr,
  Effect,
  FileSystem,
  MutableList,
  Schema,
  Sink,
  Stream,
} from "effect";
import { type ChildProcess, ChildProcessSpawner } from "effect/process";

const encodeLine = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** One completion of the log stream, as `convex logs --jsonl` prints it. */
const completion = (fields: Record<string, unknown>) =>
  encodeLine({
    executionTime: 0.0125,
    identifier: "exams/sittings.js:answer",
    kind: "Completion",
    logLines: [],
    timestamp: 1,
    udfType: "Mutation",
    usageStats: { databaseReadDocuments: 14 },
    ...fields,
  });

describe("load logs", () => {
  it.effect(
    "reads each execution's timing, reads and conflict, named by its kind, component and function",
    () =>
      Effect.gen(function* () {
        const text = Arr.join(
          [
            completion({}),
            completion({ error: "Uncaught Error: refused" }),
            completion({
              cachedResult: true,
              error: null,
              identifier: "exams/sittings.js:paper",
              udfType: "Query",
            }),
            completion({
              componentPath: "betterAuth",
              identifier: "session.js:live",
              occInfo: { tableName: "session" },
              udfType: "Query",
            }),
            completion({ occInfo: {} }),
            encodeLine({ kind: "Progress", logLines: ["working"] }),
            encodeLine({ identifier: "broken", kind: "Completion" }),
            "not json",
            "",
          ],
          "\n"
        );
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFileString(`${directory}/functions.jsonl`, text);
        const run = yield* readServerRun(`${directory}/functions.jsonl`);
        expect(run.timings).toEqual([
          {
            failed: false,
            name: "mutation:exams/sittings:answer",
            value: 12.5,
          },
          { failed: true, name: "mutation:exams/sittings:answer", value: 12.5 },
          {
            failed: false,
            name: "query:exams/sittings:paper (cached)",
            value: 12.5,
          },
          { failed: false, name: "query:betterAuth/session:live", value: 12.5 },
          {
            failed: false,
            name: "mutation:exams/sittings:answer",
            value: 12.5,
          },
        ]);
        expect(run.reads[0]).toEqual({
          failed: false,
          name: "mutation:exams/sittings:answer",
          value: 14,
        });
        expect(run.conflicts).toEqual([
          {
            failed: true,
            name: "query:betterAuth/session:live on session",
            value: 1,
          },
          {
            failed: true,
            name: "mutation:exams/sittings:answer on an unnamed table",
            value: 1,
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "streams the local backend's function log into the file while its scope lasts",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const path = `${directory}/functions.jsonl`;
        const commands = MutableList.make<ChildProcess.Command>();
        const spawner = ChildProcessSpawner.make((command) =>
          Effect.sync(() => {
            MutableList.append(commands, command);
            return ChildProcessSpawner.makeHandle({
              all: Stream.empty,
              exitCode: Effect.never,
              getInputFd: () => Sink.drain,
              getOutputFd: () => Stream.empty,
              isRunning: Effect.succeed(true),
              kill: () => Effect.void,
              pid: ChildProcessSpawner.ProcessId(1),
              stderr: Stream.empty,
              stdin: Sink.drain,
              stdout: Stream.succeed(new TextEncoder().encode(completion({}))),
              unref: Effect.succeed(Effect.void),
            });
          })
        );
        yield* Effect.scoped(
          Effect.andThen(
            captureLogs({ backend: directory }, path),
            Effect.sleep("50 millis")
          )
        ).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner
          )
        );
        expect((yield* readServerRun(path)).timings).toHaveLength(1);
        const [command] = MutableList.toArray(commands);
        expect(command?._tag === "StandardCommand" && command.args).toEqual([
          "node_modules/convex/bin/main.js",
          "logs",
          "--jsonl",
          "--success",
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
