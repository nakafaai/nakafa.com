import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  readConvexNodeMajor,
  resolveConvexNodeBin,
} from "@repo/backend/scripts/content/acceptance/node";
import { installConvexNode } from "@repo/backend/test/acceptance";
import { Effect, FileSystem, MutableList } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/** A temporary backend directory whose `convex.json` names Node 24, with that Node installed under a prefix. */
const backend = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-node-test-",
  });
  return { directory, fs, prefix: yield* installConvexNode(directory) };
});

/**
 * Runs `brew` as `answer` says, through the real spawner, and records each
 * `brew` command it was asked for.
 */
const brewAs = Effect.fn("NodeTest.brewAs")(function* (
  answer: (formula: string) => ChildProcess.Command
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const asked = MutableList.make<readonly string[]>();
  const service = ChildProcessSpawner.make((command) => {
    if (ChildProcess.isStandardCommand(command) && command.command === "brew") {
      MutableList.append(asked, command.args);
      return spawner.spawn(answer(command.args.at(-1) ?? ""));
    }
    return spawner.spawn(command);
  });
  return { asked, service };
});

/** A `brew --prefix` that prints `prefix`. */
const printing = (prefix: string) => () =>
  ChildProcess.make("sh", ["-c", 'printf "%s\\n" "$0"', prefix], {
    stdin: "ignore",
  });

describe("Node of the local Convex backend", () => {
  it.live("reads the Node major that convex.json names", () =>
    Effect.gen(function* () {
      const { directory } = yield* backend;
      expect(yield* readConvexNodeMajor(directory)).toBe("24");
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "answers the bin directory of that Node, from its Homebrew prefix",
    () =>
      Effect.gen(function* () {
        const { directory, prefix } = yield* backend;
        const brew = yield* brewAs(printing(prefix));
        const bin = yield* resolveConvexNodeBin(directory).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            brew.service
          )
        );
        expect(bin).toBe(`${prefix}/bin`);
        expect(MutableList.toArray(brew.asked)).toEqual([
          ["--prefix", "node@24"],
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "fails at once with the install command when that Node is missing",
    () =>
      Effect.gen(function* () {
        const { directory, fs, prefix } = yield* backend;
        const empty = `${directory}/homebrew/node@24-empty`;
        yield* fs.makeDirectory(`${empty}/bin`, { recursive: true });
        const answers = [
          // Homebrew names a prefix that holds no node.
          printing(empty),
          // Homebrew knows no such formula.
          () => ChildProcess.make("sh", ["-c", "exit 1"], { stdin: "ignore" }),
          // Homebrew answers nothing.
          printing(""),
          // Homebrew is not installed at all.
          () =>
            ChildProcess.make(`${prefix}/missing-brew`, [], {
              stdin: "ignore",
            }),
        ];
        for (const answer of answers) {
          const brew = yield* brewAs(answer);
          const failure = yield* resolveConvexNodeBin(directory).pipe(
            Effect.provideService(
              ChildProcessSpawner.ChildProcessSpawner,
              brew.service
            ),
            Effect.flip
          );
          expect(failure).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining("run `brew install node@24`"),
          });
        }
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
