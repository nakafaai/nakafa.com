import {
  Array as Arr,
  Effect,
  Fiber,
  MutableRef,
  Option,
  Record as Rec,
  Ref,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";
import { type Answer, scriptedShell } from "#scripts/test.shell";

/** A test that runs real Git or many scripted processes waits for them on a loaded machine. */
export const PROCESS_TIMEOUT = 60_000;

export const SHA = "a".repeat(40);
export const MAIN = "b".repeat(40);
export const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const lastArgument = (args: readonly string[]) =>
  Option.getOrThrow(Arr.last(args));
const at = (second: number) =>
  `2026-11-09T12:00:${String(second).padStart(2, "0")}.000Z`;
export const step = (
  name: string,
  from: number,
  to: number,
  conclusion = "success"
) => ({
  name,
  conclusion,
  startedAt: at(from),
  completedAt: at(to),
});

/** A completed run whose build restored the prepared runtime, and one machine per engine. */
export const RUN = {
  status: "completed",
  conclusion: "success",
  url: "https://github.com/nakafaai/nakafa.com/actions/runs/7",
  createdAt: at(0),
  updatedAt: at(50),
  jobs: [
    {
      name: "Build",
      conclusion: "success",
      startedAt: at(5),
      completedAt: at(30),
      steps: [
        step("Prepare", 6, 10),
        step("Save the prepared runtime", 10, 10, "skipped"),
        step("Build", 10, 28),
      ],
    },
    ...Arr.map(["chromium", "firefox", "webkit"], (engine, index) => ({
      name: `Specs ${engine} 1`,
      conclusion: "success",
      startedAt: at(31),
      completedAt: at(45),
      steps: [step("Run specs", 32, 40 + index)],
    })),
  ],
};

export const shard = (engine: string, failures: readonly string[] = []) =>
  toJson({ engine, shard: 1, passed: failures.length === 0, failures });

/**
 * A GitHub CLI that names the dispatched run after the nonce it was given, lists
 * it only on the second look, and downloads these shard results.
 */
export const github = (
  results: Readonly<Record<string, string>> | undefined,
  run: unknown = RUN,
  mainResults: Readonly<Record<string, string>> | undefined = results
) => {
  const nonce = MutableRef.make("");
  const dispatched = MutableRef.make("");
  const looks = MutableRef.make(0);
  return (args: readonly string[]): Answer => {
    if (args[0] === "workflow") {
      MutableRef.set(nonce, lastArgument(args).slice(6));
      MutableRef.set(
        dispatched,
        Option.getOrThrow(
          Arr.findFirst(args, (arg) => arg.startsWith("sha="))
        ).slice(4)
      );
      return {};
    }
    if (args[0] === "pr" || args[1] === "cancel") {
      return {};
    }
    if (Arr.contains(args, "--status")) {
      return { stdout: "[]" };
    }
    if (args[0] === "api") {
      return Arr.contains(args, "--silent") ? {} : { stdout: `${MAIN}\n` };
    }
    if (args[1] === "list") {
      return {
        stdout: toJson(
          MutableRef.getAndIncrement(looks) === 0
            ? []
            : [
                {
                  databaseId: 7,
                  displayTitle: `Proof ${MutableRef.get(dispatched)} ${MutableRef.get(nonce)}`,
                },
              ]
        ),
      };
    }
    if (args[1] === "view") {
      return { stdout: toJson(run) };
    }
    const directory = lastArgument(args);
    const chosen = MutableRef.get(dispatched) === MAIN ? mainResults : results;
    return chosen === undefined
      ? { code: 1, stderr: "no valid artifacts found to download" }
      : {
          files: Rec.fromEntries(
            Arr.map(Rec.toEntries(chosen), ([name, text]) => [
              `${directory}/${name}/result.json`,
              text,
            ])
          ),
        };
  };
};

/** Runs a program with gh answered by `script`, driving the test clock until it ends. */
export const withGithub = <A, E, R>(
  script: (args: readonly string[]) => Answer,
  program: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<readonly string[]>([]);
    const fiber = yield* program.pipe(
      Effect.provide(
        scriptedShell(
          // Every command these programs run is the GitHub CLI.
          (_command, args) => script(args),
          calls
        )
      ),
      Effect.exit,
      Effect.forkChild
    );
    while (fiber.pollUnsafe() === undefined) {
      yield* TestClock.withLive(Effect.sleep("10 millis"));
      yield* TestClock.adjust("30 seconds");
    }
    return { exit: yield* Fiber.join(fiber), calls: yield* Ref.get(calls) };
  });
