import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  runBuildCommand,
  withTerminal,
} from "@repo/backend/scripts/content/acceptance/terminal";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  Fiber,
  FileSystem,
  Schedule,
  Schema,
} from "effect";

/** A private folder for one test's child process and the files it writes. */
const testDirectory = Effect.flatMap(FileSystem.FileSystem, (fs) =>
  fs.makeTempDirectoryScoped({ prefix: "acceptance-terminal-test-" })
);

/** The environment a build child saw, as the child wrote it. */
const SeenEnvironment = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.String)
);

/** The credentials a build child must not see, and one value it must keep. */
const ENVIRONMENT_NAMES = [
  "VITE_CONVEX_URL",
  "AKSARA_ACCEPTANCE_PRIVATE_KEY",
  "AKSARA_SIGNING_PRIVATE_KEY",
  "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT_TOKEN",
];

describe("acceptance terminal", () => {
  it.live(
    "handles hangup through the finalizer and then releases its listener",
    () =>
      Effect.gen(function* () {
        const previous = process.listeners("SIGHUP");
        const interrupt = vi.spyOn(process, "emit").mockReturnValue(process);
        yield* withTerminal(
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                const listeners = Arr.filter(
                  process.listeners("SIGHUP"),
                  (listener) => !Arr.some(previous, (item) => item === listener)
                );
                expect(listeners).toHaveLength(1);
                for (const listener of listeners) {
                  listener("SIGHUP");
                }
                expect(interrupt).toHaveBeenCalledWith("SIGINT");
              })
            );
            return yield* acceptanceRuntimeError("interrupted operation");
          })
        ).pipe(Effect.flip);
        expect(process.listeners("SIGHUP")).toEqual(previous);
      }).pipe(Effect.ensuring(Effect.sync(() => vi.restoreAllMocks())))
  );

  it.live("waits for an interrupted command to finish its cleanup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* testDirectory;
      const script = `${directory}/worker.mjs`;
      yield* fs.writeFileString(
        script,
        `import { writeFileSync } from "node:fs";
process.once("SIGINT", () => {
  writeFileSync("stopped", "SIGINT");
  process.exit(0);
});
setInterval(() => {}, 1000);
writeFileSync("ready", "ready");`
      );
      const child = yield* runBuildCommand(directory, [
        process.execPath,
        script,
      ]).pipe(Effect.scoped, Effect.forkChild);
      yield* fs.exists(`${directory}/ready`).pipe(
        Effect.repeat({
          while: (ready) => !ready,
          schedule: Schedule.spaced("10 millis"),
        }),
        Effect.timeout("5 seconds")
      );
      yield* Fiber.interrupt(child);
      expect(yield* fs.readFileString(`${directory}/stopped`)).toBe("SIGINT");
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  for (const code of [0, 7]) {
    it.live(
      `keeps acquisition credentials out of a build child that exits with ${code}`,
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const directory = yield* testDirectory;
          const script = `${directory}/environment.mjs`;
          yield* fs.writeFileString(
            script,
            `import { writeFileSync } from "node:fs";
const names = ${encodeJsonText(ENVIRONMENT_NAMES)};
const seen = names.filter((name) => name in process.env).map((name) => [name, process.env[name]]);
writeFileSync("environment.json", JSON.stringify(Object.fromEntries(seen)));
process.exit(${code});`
          );
          const result = yield* runBuildCommand(
            directory,
            [process.execPath, script],
            {
              AKSARA_ACCEPTANCE_PRIVATE_KEY: "private",
              AKSARA_SIGNING_PRIVATE_KEY: "private",
              VITE_CONVEX_URL: "https://production.convex.cloud",
            }
          ).pipe(Effect.scoped, Effect.result);
          expect(result._tag).toBe(code === 0 ? "Success" : "Failure");
          const seen = yield* Schema.decodeEffect(SeenEnvironment)(
            yield* fs.readFileString(`${directory}/environment.json`)
          );
          expect(seen).toEqual({
            VITE_CONVEX_URL: "https://production.convex.cloud",
          });
        }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
    );
  }
});
