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
  JOB,
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
    "dispatches one job, finds and awaits its run, and reads its gate, results and phases",
    () =>
      Effect.gen(function* () {
        const { exit, calls } = yield* withGithub(
          github({
            chromium: shard("chromium"),
            firefox: shard("firefox", ["e2e/a.browser.ts"]),
            webkit: shard("webkit"),
          }),
          proveOnGithub(SHA, ["e2e/a.browser.ts"], { gate: true, full: false })
        );
        const { result, gated, timings } = yield* exit;
        expect(gated).toEqual(Option.some(true));
        expect(result.engines.firefox).toEqual({
          passed: false,
          failures: ["e2e/a.browser.ts"],
        });
        expect(result.url).toBe(RUN.url);
        expect(timings).toEqual({
          queue: Option.some(5),
          gate: Option.some(11),
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
                `^gh workflow run proof.yml --repo nakafaai/nakafa.com --ref main -f sha=${SHA} -f specs=e2e/a.browser.ts -f gate=true -f full=false -f nonce=[0-9a-f-]{36}$`,
                "u"
              )
            )
          )
        );
        expect(formatProof(result, gated, timings)).toBe(
          Arr.join(
            [
              `Proof of ${SHA}: failed`,
              RUN.url,
              "gate     passed",
              "chromium passed",
              "firefox  failed\n  e2e/a.browser.ts",
              "webkit   passed",
              "queue 5s, gate 11s, prepare 4s (restored), build 18s, specs 10s, total 50s",
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
        const { exit, calls } = yield* withGithub(
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
        // A proof alone, such as main's baseline, skips the gate.
        expect(
          Arr.some(calls, (call) =>
            call.includes("-f gate=false -f full=false")
          )
        ).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "verifies a combination whole in one job, and a gate that did not pass or run fails it",
    () =>
      Effect.gen(function* () {
        const green = {
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        };
        const verify = (run: unknown) =>
          withGithub(
            github(green, run),
            Effect.flatMap(Prover, (prover) => prover.verify(SHA, [])).pipe(
              Effect.provide(githubProver)
            )
          );
        const passed = yield* verify(RUN);
        expect((yield* passed.exit).gated).toBe(true);
        expect(
          Arr.some(passed.calls, (call) =>
            call.includes("-f gate=true -f full=true")
          )
        ).toBe(true);
        const failed = yield* verify({
          ...RUN,
          jobs: [
            {
              ...JOB,
              steps: [step("Gate www", 12, 14, "failure"), ...JOB.steps],
            },
          ],
        });
        expect((yield* failed.exit).gated).toBe(false);
        const never = yield* verify({ ...RUN, jobs: [] });
        const unread = yield* never.exit;
        expect(unread.gated).toBe(false);
        expect(unread.result.passed).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect("waits out GitHub's rate limit and goes on", () =>
    Effect.gen(function* () {
      const answer = github({
        chromium: shard("chromium"),
        firefox: shard("firefox"),
        webkit: shard("webkit"),
      });
      const refusals = MutableRef.make(2);
      const { exit, calls } = yield* withGithub(
        (args) =>
          args[0] === "workflow" && MutableRef.getAndDecrement(refusals) > 0
            ? { code: 1, stderr: "HTTP 403: API rate limit exceeded for user" }
            : answer(args),
        proveOnGithub(SHA, [], { gate: true, full: false })
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
          proveOnGithub(SHA, [], { gate: true, full: false })
        );
        expect(yield* Effect.flip(refused.exit)).toMatchObject({
          message: "gh pr list failed: HTTP 404: not found",
        });
        const garbled = yield* withGithub(
          github({}, { status: 1 }),
          proveOnGithub(SHA, [], { gate: true, full: false })
        );
        expect((yield* Effect.flip(garbled.exit)).message).toContain(
          "GitHub answered unexpectedly"
        );
        const unreadable = yield* withGithub(
          github({ chromium: "not json" }),
          proveOnGithub(SHA, [], { gate: true, full: false })
        );
        expect((yield* Effect.flip(unreadable.exit)).message).toContain(
          "The results of run 7"
        );
        const absent = yield* withGithub(
          () => ({ missing: true }),
          proveOnGithub(SHA, [], { gate: true, full: false })
        );
        expect((yield* Effect.flip(absent.exit)).message).toBe(
          "The GitHub CLI could not start."
        );
        const answer = github({});
        const vanished = yield* withGithub(
          (args) => (args[1] === "download" ? { missing: true } : answer(args)),
          proveOnGithub(SHA, [], { gate: true, full: false })
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
          {
            ...JOB,
            conclusion: "cancelled",
            startedAt: null,
            steps: [
              { ...step("Gate static", 5, 12), completedAt: null },
              { ...step("Prepare", 16, 20), completedAt: null },
              { ...step("Run specs", 38, 48), startedAt: null },
            ],
          },
        ],
      })
    ).toEqual({
      queue: Option.none(),
      gate: Option.none(),
      prepare: Option.none(),
      restored: Option.none(),
      build: Option.none(),
      specs: Option.none(),
      total: Option.some(50),
    });
    expect(runTimings({ ...RUN, jobs: [] }).queue).toEqual(Option.none());
    const passed = {
      sha: SHA,
      url: "local",
      passed: true,
      engines: {
        chromium: { passed: true, failures: [] },
        firefox: { passed: true, failures: [] },
        webkit: { passed: true, failures: [] },
      },
    };
    expect(
      formatProof(passed, Option.none(), {
        ...runTimings(RUN),
        restored: Option.some(false),
        queue: Option.none(),
      })
    ).toContain("queue -, gate 11s, prepare 4s (prepared)");
    expect(
      formatProof(passed, Option.some(false), {
        ...runTimings(RUN),
        restored: Option.none(),
      })
    ).toContain("gate     failed\nchromium passed");
    expect(
      formatProof(passed, Option.none(), {
        ...runTimings(RUN),
        restored: Option.none(),
      })
    ).toContain("prepare 4s, build");
  });
});

describe("proof waiter", () => {
  it.effect(
    "waits on GraphQL statuses and reads the run itself every fifth look",
    () =>
      Effect.gen(function* () {
        const answer = github({
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
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
          proveOnGithub(SHA, ["e2e/a.browser.ts"], { gate: true, full: false })
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
