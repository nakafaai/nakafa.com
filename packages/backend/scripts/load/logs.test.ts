import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { captureLogs, serverSamples } from "@repo/backend/scripts/load/logs";
import { Effect, FileSystem, MutableList, Schema, Sink, Stream } from "effect";
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
    ...fields,
  });

describe("load logs", () => {
  it("reads the server's timing of every completion, named by its kind and function", () => {
    const text = [
      completion({}),
      completion({ error: "Uncaught Error: refused" }),
      completion({
        error: null,
        identifier: "exams/sittings.js:paper",
        udfType: "Query",
      }),
      encodeLine({ kind: "Progress", logLines: ["working"] }),
      encodeLine({ kind: "Completion", identifier: "broken" }),
      "not json",
      "",
    ].join("\n");
    expect(serverSamples(text)).toEqual([
      { failed: false, ms: 12.5, name: "mutation:exams/sittings:answer" },
      { failed: true, ms: 12.5, name: "mutation:exams/sittings:answer" },
      { failed: false, ms: 12.5, name: "query:exams/sittings:paper" },
    ]);
  });

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
        expect(serverSamples(yield* fs.readFileString(path))).toHaveLength(1);
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
