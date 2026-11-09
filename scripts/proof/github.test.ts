import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  Fiber,
  Layer,
  MutableRef,
  Option,
  Record as Rec,
  Ref,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";
import {
  githubProver,
  Prover,
  proveOnGithub,
  runTimings,
} from "#scripts/proof/github";
import {
  formatProof,
  parseProofArguments,
  runProof,
} from "#scripts/proof/main";
import { type Answer, scriptedShell } from "#scripts/test.shell";

const SHA = "a".repeat(40);
const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const lastArgument = (args: readonly string[]) =>
  Option.getOrElse(Arr.last(args), () => "");
const at = (second: number) =>
  `2026-11-09T12:00:${String(second).padStart(2, "0")}.000Z`;
const step = (
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
const RUN = {
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

const shard = (engine: string, failures: readonly string[] = []) =>
  toJson({ engine, shard: 1, passed: failures.length === 0, failures });

/**
 * A GitHub CLI that names the dispatched run after the nonce it was given, lists
 * it only on the second look, and downloads these shard results.
 */
const github = (
  results: Readonly<Record<string, string>> | undefined,
  run: unknown = RUN
) => {
  const nonce = MutableRef.make("");
  const looks = MutableRef.make(0);
  return (args: readonly string[]): Answer => {
    if (args[0] === "workflow") {
      MutableRef.set(nonce, lastArgument(args).slice(6));
      return {};
    }
    if (args[1] === "list") {
      return {
        stdout: toJson(
          MutableRef.getAndIncrement(looks) === 0
            ? []
            : [
                {
                  databaseId: 7,
                  displayTitle: `Proof ${SHA} ${MutableRef.get(nonce)}`,
                },
              ]
        ),
      };
    }
    if (args[1] === "view") {
      return { stdout: toJson(run) };
    }
    const directory = lastArgument(args);
    return results === undefined
      ? { code: 1, stderr: "no valid artifacts found to download" }
      : {
          files: Rec.fromEntries(
            Arr.map(Rec.toEntries(results), ([name, text]) => [
              `${directory}/${name}/result.json`,
              text,
            ])
          ),
        };
  };
};

/** Runs a program with gh answered by `script`, driving the test clock until it ends. */
const withGithub = <A, E, R>(
  script: (args: readonly string[]) => Answer,
  program: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<readonly string[]>([]);
    const fiber = yield* program.pipe(
      Effect.provide(
        scriptedShell(
          (command, args) => (command === "gh" ? script(args) : undefined),
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

describe("GitHub proof runner", () => {
  it.effect(
    "dispatches a proof, finds and awaits its run, and combines its shards",
    () =>
      Effect.gen(function* () {
        const { exit, calls } = yield* withGithub(
          github({
            "result-chromium-1": shard("chromium"),
            "result-firefox-1": shard("firefox", ["e2e/a.browser.ts"]),
            "result-webkit-1": shard("webkit"),
          }),
          proveOnGithub(SHA, ["e2e/a.browser.ts"], 1)
        );
        const { result, timings } = yield* exit;
        expect(result.engines.firefox).toEqual({
          passed: false,
          failures: ["e2e/a.browser.ts"],
        });
        expect(result.url).toBe(RUN.url);
        expect(timings).toEqual({
          queue: Option.some(5),
          prepare: Option.some(4),
          restored: Option.some(true),
          build: Option.some(18),
          specs: Option.some(10),
          total: Option.some(50),
        });
        expect(calls[0]).toMatch(
          new RegExp(
            `^gh workflow run proof.yml --repo nakafaai/nakafa.com --ref main -f sha=${SHA} -f specs=e2e/a.browser.ts -f shards=1 -f nonce=[0-9a-f-]{36}$`,
            "u"
          )
        );
        expect(formatProof(result, timings)).toBe(
          Arr.join(
            [
              `Proof of ${SHA}: failed`,
              RUN.url,
              "chromium passed",
              "firefox  failed\n  e2e/a.browser.ts",
              "webkit   passed",
              "queue 5s, prepare 4s (restored), build 18s, specs 10s, total 50s",
              "",
            ],
            "\n"
          )
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails every engine of a run without results, and the prover answers the same",
    () =>
      Effect.gen(function* () {
        const { exit } = yield* withGithub(
          github(undefined),
          Effect.flatMap(Prover, (prover) => prover.prove(SHA, [])).pipe(
            Effect.provide(githubProver)
          )
        );
        const result = yield* exit;
        expect(result.passed).toBe(false);
        expect(result.engines.chromium).toEqual({
          passed: false,
          failures: [],
        });
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("fails with what GitHub said, or answered unexpectedly", () =>
    Effect.gen(function* () {
      const refused = yield* withGithub(
        () => ({ code: 1, stderr: "HTTP 404: not found\n" }),
        proveOnGithub(SHA, [], 3)
      );
      expect(yield* Effect.flip(refused.exit)).toMatchObject({
        message: "gh workflow run failed: HTTP 404: not found",
      });
      const garbled = yield* withGithub(
        github({}, { status: 1 }),
        proveOnGithub(SHA, [], 3)
      );
      expect((yield* Effect.flip(garbled.exit)).message).toContain(
        "GitHub answered unexpectedly"
      );
      const unreadable = yield* withGithub(
        github({ "result-chromium-1": "not json" }),
        proveOnGithub(SHA, [], 3)
      );
      expect((yield* Effect.flip(unreadable.exit)).message).toContain(
        "The results of run 7"
      );
      const absent = yield* withGithub(
        () => ({ missing: true }),
        proveOnGithub(SHA, [], 3)
      );
      expect((yield* Effect.flip(absent.exit)).message).toBe(
        "The GitHub CLI could not start."
      );
      const answer = github({});
      const vanished = yield* withGithub(
        (args) => (args[1] === "download" ? { missing: true } : answer(args)),
        proveOnGithub(SHA, [], 3)
      );
      expect((yield* Effect.flip(vanished.exit)).message).toBe(
        "The results of run 7: The GitHub CLI could not start."
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it("reads no phase that a run never reached", () => {
    expect(
      runTimings({
        ...RUN,
        jobs: [
          { ...RUN.jobs[0], name: "Other", startedAt: null, steps: [] },
          {
            name: "Build",
            conclusion: "cancelled",
            startedAt: null,
            completedAt: null,
            steps: [{ ...step("Prepare", 6, 10), completedAt: null }],
          },
          {
            ...RUN.jobs[1],
            startedAt: null,
            steps: [{ ...step("Run specs", 1, 2), startedAt: null }],
          },
        ],
      })
    ).toEqual({
      queue: Option.none(),
      prepare: Option.none(),
      restored: Option.none(),
      build: Option.none(),
      specs: Option.none(),
      total: Option.some(50),
    });
    expect(
      formatProof(
        {
          sha: SHA,
          url: "local",
          passed: true,
          engines: {
            chromium: { passed: true, failures: [] },
            firefox: { passed: true, failures: [] },
            webkit: { passed: true, failures: [] },
          },
        },
        {
          ...runTimings(RUN),
          restored: Option.some(false),
          queue: Option.none(),
        }
      )
    ).toContain("queue -, prepare 4s (prepared)");
    expect(
      formatProof(
        {
          sha: SHA,
          url: "local",
          passed: true,
          engines: {
            chromium: { passed: true, failures: [] },
            firefox: { passed: true, failures: [] },
            webkit: { passed: true, failures: [] },
          },
        },
        { ...runTimings(RUN), restored: Option.none() }
      )
    ).toContain("prepare 4s, build");
  });
});

describe("proof command line", () => {
  it.effect("reads where, which head, which specs and how many machines", () =>
    Effect.gen(function* () {
      expect(
        yield* parseProofArguments([SHA, "e2e/a.browser.ts", "--shards=2"])
      ).toEqual({
        local: false,
        shards: 2,
        sha: SHA,
        specs: ["e2e/a.browser.ts"],
      });
      expect(yield* parseProofArguments(["--local", SHA])).toEqual({
        local: true,
        shards: 3,
        sha: SHA,
        specs: [],
      });
      for (const argv of [
        [],
        ["main"],
        [SHA, "--shards=9"],
        [SHA, "src/a.ts"],
      ]) {
        expect(
          (yield* Effect.flip(parseProofArguments(argv))).message
        ).toContain("Usage: bun run proof");
      }
    })
  );

  it.effect("proves on GitHub, or here through the acceptance runtime", () =>
    Effect.gen(function* () {
      const remote = yield* withGithub(
        github({
          "result-chromium-1": shard("chromium"),
          "result-firefox-1": shard("firefox"),
          "result-webkit-1": shard("webkit"),
        }),
        runProof("/root", [SHA, "--shards=1"]).pipe(Effect.provide(Layer.empty))
      );
      expect(yield* remote.exit).toBe(0);
      const failing = yield* withGithub(
        github(undefined),
        runProof("/root", [SHA])
      );
      expect(yield* failing.exit).toBe(1);

      const calls = yield* Ref.make<readonly string[]>([]);
      const code = yield* runProof("/root", [
        "--local",
        SHA,
        "e2e/a.browser.ts",
      ]).pipe(
        Effect.provide(
          scriptedShell(
            (command) => (command === "bun" ? { code: 3 } : undefined),
            calls
          )
        )
      );
      expect(code).toBe(3);
      expect(yield* Ref.get(calls)).toEqual([
        `bun run --cwd packages/backend acceptance proof ${SHA} e2e/a.browser.ts`,
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
