import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, MutableRef, Option } from "effect";
import {
  githubProver,
  Prover,
  proveOnGithub,
  runTimings,
  sweepSuperseded,
} from "#scripts/proof/github";
import { formatProof } from "#scripts/proof/main";
import {
  github,
  MAIN,
  PROCESS_TIMEOUT,
  RUN,
  SHA,
  shard,
  statusAnswer,
  step,
  toJson,
  withGithub,
} from "#scripts/proof/test.github";

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
        expect(
          Arr.findFirst(calls, (call) => call.startsWith("gh workflow run"))
        ).toEqual(
          Option.some(
            expect.stringMatching(
              new RegExp(
                `^gh workflow run proof.yml --repo nakafaai/nakafa.com --ref main -f sha=${SHA} -f specs=e2e/a.browser.ts -f shards=1 -f nonce=[0-9a-f-]{36}$`,
                "u"
              )
            )
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

  it.effect("waits out GitHub's rate limit and goes on", () =>
    Effect.gen(function* () {
      const answer = github({
        "result-chromium-1": shard("chromium"),
        "result-firefox-1": shard("firefox"),
        "result-webkit-1": shard("webkit"),
      });
      const refusals = MutableRef.make(2);
      const { exit, calls } = yield* withGithub(
        (args) =>
          args[0] === "workflow" && MutableRef.getAndDecrement(refusals) > 0
            ? { code: 1, stderr: "HTTP 403: API rate limit exceeded for user" }
            : answer(args),
        proveOnGithub(SHA, [], 1)
      );
      expect((yield* exit).result.passed).toBe(true);
      expect(
        Arr.filter(calls, (call) => call.startsWith("gh workflow run"))
      ).toHaveLength(3);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails with what GitHub said, or answered unexpectedly",
    () =>
      Effect.gen(function* () {
        const refused = yield* withGithub(
          () => ({ code: 1, stderr: "HTTP 404: not found\n" }),
          proveOnGithub(SHA, [], 3)
        );
        expect(yield* Effect.flip(refused.exit)).toMatchObject({
          message: "gh pr list failed: HTTP 404: not found",
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
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
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

describe("proof waiter", () => {
  it.effect(
    "waits on GraphQL statuses and reads the run itself every fifth look",
    () =>
      Effect.gen(function* () {
        const answer = github({
          "result-chromium-1": shard("chromium"),
          "result-firefox-1": shard("firefox"),
          "result-webkit-1": shard("webkit"),
        });
        const graphql = [
          toJson({ data: { repository: { object: null } } }),
          statusAnswer(null),
          statusAnswer([{ state: "PENDING", targetUrl: RUN.url }]),
          statusAnswer([
            { state: "SUCCESS", targetUrl: "https://example.test/runs/6" },
          ]),
        ];
        const looked = MutableRef.make(0);
        const { exit, calls } = yield* withGithub(
          (args) => {
            if (args[1] === "graphql") {
              return {
                stdout:
                  graphql[MutableRef.getAndIncrement(looked)] ??
                  statusAnswer([]),
              };
            }
            if (args[1] === "view" && Arr.contains(args, "status")) {
              return { stdout: toJson({ status: "completed" }) };
            }
            return answer(args);
          },
          proveOnGithub(SHA, ["e2e/a.browser.ts"], 1)
        );
        expect((yield* exit).result.passed).toBe(true);
        expect(
          Arr.filter(calls, (call) => call.includes("api graphql"))
        ).toHaveLength(5);
        expect(
          Arr.filter(calls, (call) => call.endsWith("--json status"))
        ).toHaveLength(1);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );
});

describe("superseded proof runs", () => {
  it.effect(
    "cancels the queued runs of heads no pull request, train or main holds",
    () =>
      Effect.gen(function* () {
        const open = "1".repeat(40);
        const train = "2".repeat(40);
        const gone = "3".repeat(40);
        const refused = "4".repeat(40);
        // A baseline of a commit main has since moved past.
        const onMain = "5".repeat(40);
        const { exit, calls } = yield* withGithub((args) => {
          if (args[0] === "pr") {
            return { stdout: `${open}\n` };
          }
          if (args[0] === "api") {
            return {
              stdout: Arr.some(args, (arg) => arg.includes("matching-refs"))
                ? `${train}\n`
                : `${MAIN}\n`,
            };
          }
          if (args[0] === "fetch") {
            return {};
          }
          if (args[0] === "merge-base") {
            return { code: args[2] === onMain ? 0 : 1 };
          }
          if (args[1] === "cancel") {
            return args[2] === "14"
              ? {
                  code: 1,
                  stderr: "Cannot cancel a workflow run that is completed",
                }
              : {};
          }
          return {
            stdout: toJson([
              { databaseId: 10, displayTitle: `Proof ${open} a` },
              { databaseId: 11, displayTitle: `Proof ${train} b` },
              { databaseId: 12, displayTitle: `Proof ${MAIN} c` },
              { databaseId: 13, displayTitle: `Proof ${gone} d` },
              { databaseId: 14, displayTitle: `Proof ${refused} e` },
              { databaseId: 15, displayTitle: `Gate ${gone} f` },
              { databaseId: 16, displayTitle: `Proof ${onMain} g` },
            ]),
          };
        }, sweepSuperseded());
        expect(yield* exit).toBe(2);
        expect(
          Arr.filter(calls, (call) => call.startsWith("gh run cancel"))
        ).toEqual([
          "gh run cancel 13 --repo nakafaai/nakafa.com",
          "gh run cancel 14 --repo nakafaai/nakafa.com",
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
describe("superseded proof runs without Git", () => {
  it.effect("fails when Git cannot fetch main or cannot start", () =>
    Effect.gen(function* () {
      const answer = github({});
      const offline = yield* withGithub(
        (args) =>
          args[0] === "fetch"
            ? { code: 1, stderr: "fatal: unable to access origin\n" }
            : answer(args),
        sweepSuperseded()
      );
      expect((yield* Effect.flip(offline.exit)).message).toBe(
        "git fetch failed: fatal: unable to access origin"
      );
      const missing = yield* withGithub(
        (args) => (args[0] === "fetch" ? { missing: true } : answer(args)),
        sweepSuperseded()
      );
      expect((yield* Effect.flip(missing.exit)).message).toBe(
        "Git could not start."
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
