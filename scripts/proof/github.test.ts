import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, MutableRef, Option } from "effect";
import {
  githubProver,
  Prover,
  proveOnGithub,
  runTimings,
} from "#scripts/proof/github";
import { formatProof } from "#scripts/proof/main";
import {
  github,
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
