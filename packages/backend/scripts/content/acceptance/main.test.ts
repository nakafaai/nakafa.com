import { fileURLToPath } from "node:url";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import type { AcceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  acceptanceModes,
  runAcceptanceCli,
} from "@repo/backend/scripts/content/acceptance/main";
import type {
  AcceptanceMode,
  AcceptanceModeError,
} from "@repo/backend/scripts/content/acceptance/mode";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, FileSystem, Layer } from "effect";

/** The usage line, which names every mode with its arguments in the registry's order. */
const USAGE =
  "Usage: acceptance <prepare|build|start|clean|learner <cookie-file>|school <school-file>|owner <school-slug> <cookie-file>|teacher <school-slug> <cookie-file>|invite <school-slug> <learner-address> <cookie-file>|sitting <school-slug> <learner-email> <sitting-file> [crowd]|card <school-slug> <card-file>|student <school-slug> <learner-address>|import <table> <rows-file>|profile <auth-user-id> <profile-json-file>>";

/** The mode words of the registry, in the order that the usage lists them. */
const MODE_WORDS = [
  "prepare",
  "build",
  "start",
  "clean",
  "learner",
  "school",
  "owner",
  "teacher",
  "invite",
  "sitting",
  "card",
  "student",
  "import",
  "profile",
];

/** The services that a mode may use, which the command line's layer provides. */
const services = Layer.merge(nodeServicesLayer, FetchClient);

type CommandLine = Effect.Effect<
  void,
  AcceptanceRuntimeError | AcceptanceModeError
>;

const mocks = vi.hoisted(() => {
  let entry: CommandLine | undefined;
  return {
    getEntry: () => entry,
    resetEntry: () => {
      entry = undefined;
    },
    runMain: vi.fn((program: CommandLine) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));

const originalArgv = process.argv;

/**
 * Loads the command line with the arguments after its name, then runs the Effect
 * that the real wiring hands to the runtime.
 */
const runCommandLine = Effect.fn("AcceptanceCliTest.runCommandLine")(function* (
  ...args: readonly string[]
) {
  process.argv = ["node", "acceptance", ...args];
  mocks.resetEntry();
  yield* Effect.promise(
    () => import("@repo/backend/scripts/content/acceptance/main")
  );
  const entry = mocks.getEntry();
  if (entry === undefined) {
    return yield* Effect.die("CLI did not install its Effect entrypoint");
  }
  return yield* entry;
});

describe("isolated acceptance CLI", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.argv = originalArgv;
  });

  it.live(
    "loads the real CLI through native Node before validating its mode",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-native-cli-test-",
        });
        const outputPath = `${directory}/output.log`;
        yield* runAcceptanceCommand({
          args: [
            fileURLToPath(new URL("./main.ts", import.meta.url)),
            "unsupported",
          ],
          command: process.execPath,
          operation: "Native acceptance CLI",
          stdoutPath: outputPath,
          stderrPath: outputPath,
        }).pipe(Effect.flip);
        expect(yield* fs.readFileString(outputPath)).toContain(
          `AcceptanceRuntimeError: ${USAGE}`
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("answers the usage of every mode for a missing mode", () =>
    Effect.gen(function* () {
      expect(yield* runCommandLine().pipe(Effect.flip)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: USAGE,
      });
    })
  );

  it.effect("answers the same usage for an unknown mode", () =>
    Effect.gen(function* () {
      expect(
        yield* runCommandLine("unsupported").pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: USAGE,
      });
    })
  );

  it.effect("names every registered mode in the usage, in registry order", () =>
    Effect.gen(function* () {
      expect(Arr.map(acceptanceModes, (mode) => mode.mode)).toEqual(MODE_WORDS);
      expect(
        yield* runAcceptanceCli(
          "/root",
          ["node", "acceptance"],
          acceptanceModes
        ).pipe(Effect.flip)
      ).toMatchObject({ message: USAGE });
    }).pipe(Effect.provide(services))
  );

  it.effect(
    "runs the mode that the first argument names, with the arguments after it",
    () =>
      Effect.gen(function* () {
        const chosen = vi.fn(
          (_root: string, _args: readonly string[]) => Effect.void
        );
        const other = vi.fn(
          (_root: string, _args: readonly string[]) => Effect.void
        );
        const modes: readonly AcceptanceMode[] = [
          { mode: "other", usage: "other <value>", run: other },
          { mode: "chosen", usage: "chosen <one> <two>", run: chosen },
        ];

        yield* runAcceptanceCli(
          "/root",
          ["node", "acceptance", "chosen", "one", "two", "three"],
          modes
        );

        expect(chosen).toHaveBeenCalledExactlyOnceWith("/root", [
          "one",
          "two",
          "three",
        ]);
        expect(other).not.toHaveBeenCalled();
      }).pipe(Effect.provide(services))
  );

  it.effect(
    "refuses an unknown mode with the usage of the registry and runs none",
    () =>
      Effect.gen(function* () {
        const run = vi.fn(
          (_root: string, _args: readonly string[]) => Effect.void
        );
        const modes: readonly AcceptanceMode[] = [
          { mode: "chosen", usage: "chosen <one>", run },
        ];

        expect(
          yield* runAcceptanceCli(
            "/root",
            ["node", "acceptance", "missing"],
            modes
          ).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: "Usage: acceptance <chosen <one>>",
        });
        expect(run).not.toHaveBeenCalled();
      }).pipe(Effect.provide(services))
  );
});
