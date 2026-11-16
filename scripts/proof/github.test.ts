import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, MutableRef, Option } from "effect";
import { githubProver, Prover, proveOnGithub } from "#scripts/proof/github";
import { formatProof } from "#scripts/proof/main";
import {
  GATE_JOB,
  github,
  MAIN,
  PROCESS_TIMEOUT,
  REUSABLE,
  RUN,
  SHA,
  shard,
  statusAnswer,
  step,
  toJson,
  withGithub,
} from "#scripts/proof/test.github";

/** The failure of a proof whose three dispatches all started no run. */
const LOST_RUN =
  /^No run is named Proof a{40} [0-9a-f-]{36}: 3 dispatches started none\.$/u;

/** The nonce of a proof of the specs alone: their key, then a fresh suffix. */
const BASE_NONCE = /-f nonce=(?<key>base-[0-9a-f]{16})-[0-9a-f]{8}$/u;

describe("GitHub proof runner", () => {
  it.effect(
    "dispatches one run, finds and awaits it, and reads its gate, results and phases across its jobs",
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
          prepare: Option.some(6),
          restored: Option.some(true),
          build: Option.some(20),
          specs: Option.some(21),
          total: Option.some(50),
        });
        expect(
          Arr.findFirst(calls, (call) => call.startsWith("gh workflow run"))
        ).toEqual(
          Option.some(
            expect.stringMatching(
              new RegExp(
                `^gh workflow run proof.yml --repo nakafaai/nakafa.com --ref main -f sha=${SHA} -f specs=e2e/a.browser.ts -f gate=true -f full=false -f retries=true -f nonce=[0-9a-f-]{36}$`,
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
              "queue 5s, gate 11s, prepare 6s (restored), build 20s, specs 21s, total 50s",
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
        // A proof alone, such as main's baseline, skips the gate and retries
        // no failing test, so a flaky spec on main stays a failure of main.
        expect(
          Arr.some(calls, (call) =>
            call.includes("-f gate=false -f full=false -f retries=false")
          )
        ).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "names a proof of the specs alone by its head and specs, and reads a run of them that another caller started",
    () =>
      Effect.gen(function* () {
        const green = {
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        };
        const first = yield* withGithub(
          github(green),
          proveOnGithub(MAIN, ["e2e/b.browser.ts", "e2e/a.browser.ts"], {
            gate: false,
            full: false,
          })
        );
        yield* first.exit;
        const dispatch = Option.getOrThrow(
          Arr.findFirst(first.calls, (call) =>
            call.startsWith("gh workflow run")
          )
        );
        const key = Option.getOrThrow(
          Option.fromNullishOr(BASE_NONCE.exec(dispatch)?.groups?.key)
        );
        // The same specs in another order find that run: a cancelled one
        // proves nothing and is passed over, a running one is awaited.
        const listed = github(green);
        const second = yield* withGithub(
          (args) =>
            Arr.contains(args, REUSABLE)
              ? {
                  stdout: toJson([
                    {
                      databaseId: 8,
                      displayTitle: `Proof ${MAIN} ${key}-cafebabe`,
                      conclusion: "cancelled",
                    },
                    {
                      databaseId: 9,
                      displayTitle: `Proof ${MAIN} ${key}-deadbeef`,
                      conclusion: "",
                    },
                  ]),
                }
              : listed(args),
          proveOnGithub(MAIN, ["e2e/a.browser.ts", "e2e/b.browser.ts"], {
            gate: false,
            full: false,
          })
        );
        expect((yield* second.exit).result.passed).toBe(true);
        expect(
          Arr.some(second.calls, (call) => call.startsWith("gh workflow run"))
        ).toBe(false);
        expect(
          Arr.some(second.calls, (call) => call.startsWith("gh run view 9 "))
        ).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "reads the gate from its steps: a gate that did not pass or run is no pass",
    () =>
      Effect.gen(function* () {
        const green = {
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        };
        const proveRun = (run: unknown) =>
          withGithub(
            github(green, run),
            proveOnGithub(SHA, [], { gate: true, full: false })
          );
        const passed = yield* proveRun(RUN);
        expect((yield* passed.exit).gated).toEqual(Option.some(true));
        expect(
          Arr.some(passed.calls, (call) =>
            call.includes("-f gate=true -f full=false")
          )
        ).toBe(true);
        const failed = yield* proveRun({
          ...RUN,
          jobs: [
            {
              ...GATE_JOB,
              steps: [step("Gate www", 12, 14, "failure"), ...GATE_JOB.steps],
            },
          ],
        });
        expect((yield* failed.exit).gated).toEqual(Option.some(false));
        const never = yield* proveRun({ ...RUN, jobs: [] });
        const unread = yield* never.exit;
        expect(unread.gated).toEqual(Option.none());
        expect(unread.result.passed).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "dispatches a run again that was cancelled from outside, instead of reading it as a failure",
    () =>
      Effect.gen(function* () {
        const answer = github({
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        });
        const views = MutableRef.make(0);
        const { exit, calls } = yield* withGithub(
          (args) =>
            args[1] === "view" &&
            Arr.some(args, (arg) => arg.endsWith(",jobs")) &&
            MutableRef.getAndIncrement(views) === 0
              ? { stdout: toJson({ ...RUN, conclusion: "cancelled" }) }
              : answer(args),
          Effect.flatMap(Prover, (prover) => prover.prove(SHA, [])).pipe(
            Effect.provide(githubProver)
          )
        );
        expect((yield* exit).passed).toBe(true);
        expect(
          Arr.filter(calls, (call) => call.startsWith("gh workflow run"))
        ).toHaveLength(2);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "dispatches again under a fresh nonce when GitHub accepts a dispatch and starts no run, and fails after the third",
    () =>
      Effect.gen(function* () {
        const answer = github({
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        });
        // GitHub accepts these dispatches and starts no run for them.
        const losing = (lost: number) => {
          const left = MutableRef.make(lost);
          return (args: readonly string[]) =>
            args[0] === "workflow" && MutableRef.getAndDecrement(left) > 0
              ? {}
              : answer(args);
        };
        const dispatches = (calls: readonly string[]) =>
          Arr.map(
            Arr.filter(calls, (call) => call.startsWith("gh workflow run")),
            (call) => call.slice(call.indexOf("-f nonce="))
          );

        const once = yield* withGithub(
          losing(1),
          proveOnGithub(SHA, [], { gate: true, full: false })
        );
        expect((yield* once.exit).result.passed).toBe(true);
        const [first, second] = dispatches(once.calls);
        expect(dispatches(once.calls)).toHaveLength(2);
        expect(second).not.toBe(first);

        const always = yield* withGithub(
          losing(3),
          proveOnGithub(SHA, [], { gate: true, full: false })
        );
        const error = yield* Effect.flip(always.exit);
        expect(error.message).toMatch(LOST_RUN);
        expect(dispatches(always.calls)).toHaveLength(3);
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
