import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Fiber,
  MutableRef,
  Option,
  Ref,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";
import { POLL, verdictOf, waitAfter } from "#scripts/gate/github";
import { formatGate, parseGateArguments, runGate } from "#scripts/gate/main";
import { type Answer, scriptedShell } from "#scripts/test.shell";

const SHA = "a".repeat(40);
const URL = "https://github.com/nakafaai/nakafa.com/actions/runs/9";
const DATE = "Fri, 13 Nov 2026 10:00:00 GMT";
const NOW = DateTime.makeUnsafe("2026-11-13T10:00:00Z");
/** The limit resets an hour after DATE. */
const RESET = DateTime.toEpochMillis(NOW) / 1000 + 3600;
const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const status = (
  context: string,
  state: string,
  createdAt = "2026-11-13T10:30:00Z",
  description: string | null = state.toLowerCase(),
  targetUrl: string | null = URL
) => ({ context, state, description, targetUrl, createdAt });
type Status = ReturnType<typeof status>;

const commit = (contexts: readonly Status[] | null) => ({
  data: {
    repository: {
      object: { status: contexts === null ? null : { contexts } },
    },
  },
});

/** What `gh api graphql --include` prints: the status line, the headers, a blank line, the body. */
const response = (body: unknown, remaining = 4000): Answer => ({
  stdout: Arr.join(
    [
      "HTTP/2.0 200 OK",
      `Date: ${DATE}`,
      `X-Ratelimit-Remaining: ${remaining}`,
      `X-Ratelimit-Reset: ${RESET}`,
      "",
      toJson(body),
    ],
    "\r\n"
  ),
});

const OLD_PASS = status("gate", "SUCCESS", "2026-11-13T09:00:00Z");
const PARTS = [
  status("gate/typecheck", "SUCCESS"),
  status("gate/policy", "FAILURE", "2026-11-13T10:30:00Z", null),
];

/**
 * A GitHub CLI whose looks at the head answer `looks` in order, the last one
 * from then on, and whose dispatch answers `dispatch`.
 */
const github = (looks: readonly Answer[], dispatch: Answer = {}) => {
  const seen = MutableRef.make(0);
  return (args: readonly string[]): Answer => {
    if (args[0] === "workflow") {
      return dispatch;
    }
    const index = Math.min(MutableRef.getAndIncrement(seen), looks.length - 1);
    return Option.getOrElse(Arr.get(looks, index), () => ({}));
  };
};

/** Runs the gate command with gh answered by `script`, driving the test clock until it ends. */
const gate = (script: (args: readonly string[]) => Answer, argv = [SHA]) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<readonly string[]>([]);
    const fiber = yield* runGate(argv).pipe(
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
      yield* TestClock.adjust("10 minutes");
    }
    return { exit: yield* Fiber.join(fiber), calls: yield* Ref.get(calls) };
  });

const failureOf = <A, E extends { readonly message: string }>(
  exit: import("effect").Exit.Exit<A, E>
) =>
  exit._tag === "Failure"
    ? Option.getOrElse(
        Option.map(
          Arr.findFirst(exit.cause.reasons, (reason) => reason._tag === "Fail"),
          (reason) => (reason._tag === "Fail" ? reason.error.message : "")
        ),
        () => "defect"
      )
    : "success";

describe("gate", () => {
  it.effect(
    "dispatches a gate, ignores the older verdict and a failed look, and fails on the run's failed verdict",
    () =>
      Effect.gen(function* () {
        const { exit, calls } = yield* gate(
          github([
            response(commit([OLD_PASS])),
            response(commit([OLD_PASS])),
            { code: 1, stderr: "connection reset" },
            response(commit(null)),
            response(commit([...PARTS, status("gate", "FAILURE")])),
          ])
        );
        expect(exit).toEqual(expect.objectContaining({ _tag: "Success" }));
        expect(exit._tag === "Success" ? exit.value : -1).toBe(1);
        expect(
          Arr.filter(calls, (call) => call.startsWith("gh workflow"))
        ).toEqual([
          `gh workflow run gate.yml --repo nakafaai/nakafa.com --ref main -f sha=${SHA}`,
        ]);
        expect(calls[0]).toContain(
          `-f owner=nakafaai -f name=nakafa.com -f oid=${SHA}`
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "waits out a spent rate limit before the dispatch, and passes on the run's passed verdict",
    () =>
      Effect.gen(function* () {
        const { exit } = yield* gate(
          github([
            response({ errors: [{ type: "RATE_LIMITED" }] }, 0),
            response(commit([])),
            response(commit([status("gate", "PENDING")]), 10),
            response(commit([...PARTS, status("gate", "SUCCESS")])),
          ])
        );
        expect(exit._tag === "Success" ? exit.value : -1).toBe(0);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("refuses what it cannot gate", () =>
    Effect.gen(function* () {
      const failure = (
        looks: readonly Answer[],
        argv = [SHA],
        dispatch: Answer = {}
      ) =>
        gate(github(looks, dispatch), argv).pipe(
          Effect.map(({ exit }) => failureOf(exit))
        );
      expect(yield* failure([], [SHA, "extra"])).toBe(
        "Usage: bun run gate <sha>"
      );
      expect(yield* failure([], ["main"])).toBe("Usage: bun run gate <sha>");
      expect(yield* failure([], [])).toBe("Usage: bun run gate <sha>");
      expect(
        yield* failure([response({ data: { repository: { object: null } } })])
      ).toBe(`GitHub has no commit ${SHA}: push it first.`);
      expect(yield* failure([{ code: 1, stderr: "not logged in" }])).toBe(
        `GitHub could not read ${SHA}: not logged in`
      );
      expect(yield* failure([{ missing: true }])).toBe(
        "The GitHub CLI could not start."
      );
      expect(
        yield* failure([response(commit([]))], [SHA], {
          code: 1,
          stderr: "workflow gate.yml not found",
        })
      ).toBe("gh workflow run failed: workflow gate.yml not found");
      expect(
        yield* failure([response(commit([status("gate", "PENDING")]))])
      ).toBe(
        `No verdict on ${SHA} after 3h: read its gate statuses on GitHub.`
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reads the head named on the command line", () =>
    Effect.gen(function* () {
      expect(yield* parseGateArguments([SHA])).toBe(SHA);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it("waits the poll interval, or until the limit resets once it runs low", () => {
    const headers = (remaining: number, reset: number) => ({
      "x-ratelimit-remaining": String(remaining),
      "x-ratelimit-reset": String(reset),
    });
    expect(waitAfter({}, Option.some(NOW))).toEqual(POLL);
    expect(waitAfter(headers(10, RESET), Option.none())).toEqual(POLL);
    expect(waitAfter(headers(4000, RESET), Option.some(NOW))).toEqual(POLL);
    expect(waitAfter(headers(10, RESET), Option.some(NOW))).toEqual(
      Duration.seconds(3605)
    );
    expect(
      waitAfter(
        headers(10, DateTime.toEpochMillis(NOW) / 1000),
        Option.some(NOW)
      )
    ).toEqual(POLL);
  });

  it("takes only a finished verdict posted since the dispatch", () => {
    expect(verdictOf([OLD_PASS], NOW)).toEqual(Option.none());
    expect(verdictOf([status("gate", "PENDING")], NOW)).toEqual(Option.none());
    expect(
      verdictOf(
        [
          status("gate", "SUCCESS", "2026-11-13T10:30:00Z", "passed", null),
          ...PARTS,
        ],
        NOW
      )
    ).toEqual(Option.some({ passed: true, url: "", parts: PARTS }));
  });

  it("formats a verdict with each part's state", () => {
    expect(formatGate(SHA, { passed: false, url: URL, parts: PARTS })).toBe(
      Arr.join(
        [
          `Gate of ${SHA}: failed`,
          URL,
          "gate/typecheck    success (success)",
          "gate/policy       failure",
          "",
        ],
        "\n"
      )
    );
    expect(formatGate(SHA, { passed: true, url: URL, parts: [] })).toBe(
      `Gate of ${SHA}: passed\n${URL}\n`
    );
  });
});
