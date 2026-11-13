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

/** The one job of a run: its gate passed, its build restored the prepared runtime. */
export const JOB = {
  name: "Verify",
  conclusion: "success",
  startedAt: at(5),
  completedAt: at(49),
  steps: [
    step("Gate static", 5, 12),
    step("Gate www", 12, 14),
    step("Gate backend", 14, 16),
    step("Prepare", 16, 20),
    step("Save the prepared runtime", 20, 20, "skipped"),
    step("Build", 20, 38),
    step("Run specs", 38, 48),
  ],
};

/** A completed run of that job. */
export const RUN = {
  status: "completed",
  conclusion: "success",
  url: "https://github.com/nakafaai/nakafa.com/actions/runs/7",
  createdAt: at(0),
  updatedAt: at(50),
  jobs: [JOB],
};

export const shard = (engine: string, failures: readonly string[] = []) =>
  toJson({ engine, shard: 1, passed: failures.length === 0, failures });

/** The result of each engine that a download writes into the directory it was given. */
const download = (
  directory: string,
  chosen: Readonly<Record<string, string>> | undefined
): Answer =>
  chosen === undefined
    ? { code: 1, stderr: "no valid artifacts found to download" }
    : {
        files: Rec.fromEntries(
          Arr.map(Rec.toEntries(chosen), ([name, text]) => [
            `${directory}/${name}/result.json`,
            text,
          ])
        ),
      };

/** One `proof` status on a head, as the waiter reads it. */
const ProofStatus = Schema.Struct({
  state: Schema.String,
  targetUrl: Schema.String,
});

/** A GraphQL answer with these `proof` statuses on the head, or with no status at all. */
export const statusAnswer = (
  proofs: readonly (typeof ProofStatus.Type)[] | null
) =>
  toJson({
    data: {
      repository: {
        object: {
          status:
            proofs === null
              ? null
              : {
                  contexts: Arr.map(proofs, (proof) => ({
                    context: "proof",
                    ...proof,
                  })),
                },
        },
      },
    },
  });

/** What the calls around a proof answer: the sweep's lists, the head of main and the statuses posted. */
const housekeeping = (args: readonly string[]): Answer | undefined => {
  if (args[0] === "pr" || args[0] === "fetch" || args[1] === "cancel") {
    return {};
  }
  if (Arr.contains(args, "--status")) {
    return { stdout: "[]" };
  }
  if (args[1] === "graphql") {
    return { stdout: statusAnswer([{ state: "SUCCESS", targetUrl: RUN.url }]) };
  }
  if (args[0] === "api") {
    return Arr.contains(args, "--silent") ? {} : { stdout: `${MAIN}\n` };
  }
};

/**
 * A GitHub CLI that names the dispatched run after the nonce it was given, lists
 * it only on the second look, and downloads these results.
 */
export const github = (
  results: Readonly<Record<string, string>> | undefined,
  run: unknown = RUN,
  mainResults: Readonly<Record<string, string>> | undefined = results
) => {
  const nonce = MutableRef.make("");
  const dispatched = MutableRef.make("");
  const looks = MutableRef.make(0);
  const dispatch = (args: readonly string[]): Answer => {
    MutableRef.set(nonce, lastArgument(args).slice(6));
    MutableRef.set(
      dispatched,
      Option.getOrThrow(
        Arr.findFirst(args, (arg) => arg.startsWith("sha="))
      ).slice(4)
    );
    return {};
  };
  const list = (): Answer => ({
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
  });
  return (args: readonly string[]): Answer => {
    if (args[0] === "workflow") {
      return dispatch(args);
    }
    const kept = housekeeping(args);
    if (kept !== undefined) {
      return kept;
    }
    if (args[1] === "list") {
      return list();
    }
    if (args[1] === "view") {
      return { stdout: toJson(run) };
    }
    return download(
      lastArgument(args),
      MutableRef.get(dispatched) === MAIN ? mainResults : results
    );
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
