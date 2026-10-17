import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/assessment/gate/admit";
import { Rule } from "@repo/backend/confect/assessment/gate/rules";
import { Attempt, DeviceId } from "@repo/backend/confect/assessment/gate/store";
import type { ResponseSpec } from "@repo/backend/confect/response/model";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

const NOW = 1_000_000;
const HOUR = 3_600_000;

/** A failure of the in-memory store's own integrity checks. */
class Corrupt extends Schema.TaggedError<Corrupt>()("Corrupt", {}) {}

/** A frozen single-choice question whose key is `a`. */
const response: ResponseSpec = {
  kind: "single-choice",
  options: [
    { isCorrect: true, label: "A", optionKey: "a", order: 1 },
    { isCorrect: false, label: "B", optionKey: "b", order: 2 },
  ],
};

/**
 * The in-memory store's one attempt: its attempt stage, its running
 * section's deadline (none once it ended or before it started), whether the
 * section's rows fail the store's checks before the deadline and whether the
 * question's stored rows fail them after it, and the version of the question's
 * latest write.
 */
const Memory = Schema.Struct({
  attempt: Attempt,
  corrupt: Schema.Boolean,
  corruptRows: Schema.Boolean,
  section: Schema.Option(Schema.Finite),
  version: Schema.Option(Schema.Int),
});
type Memory = typeof Memory.Type;

/** A learner's open, unlocked, unbound attempt with a running section, both closing in an hour. */
const live = Memory.make({
  attempt: {
    deadline: NOW + HOUR,
    device: Option.none(),
    locked: false,
    open: true,
  },
  corrupt: false,
  corruptRows: false,
  section: Option.some(NOW + HOUR),
  version: Option.none(),
});

/** The live attempt with some fields of its attempt stage changed. */
const attempt = (fields: Partial<Attempt>) =>
  Memory.make({ ...live, attempt: { ...live.attempt, ...fields } });

/** The live attempt with some of its other fields changed. */
const changed = (fields: Partial<Memory>) =>
  Memory.make({ ...live, ...fields });

/**
 * Builds the gate over one in-memory attempt that the learner owns: the
 * question `q` and the section `s` exist. Every section read, every read of
 * the question's stored rows, and every write is appended to the returned log.
 */
const memory = Effect.fn("test.gate.memory")(function* (state: Memory) {
  const log = yield* Ref.make<readonly string[]>([]);
  const record = (entry: string) => Ref.update(log, Arr.append(entry));
  const verify: Effect.Effect<void, Corrupt> = state.corrupt
    ? Effect.fail(new Corrupt())
    : Effect.void;
  const rows = record("rows").pipe(
    Effect.andThen(
      state.corruptRows
        ? Effect.fail(new Corrupt())
        : Effect.succeed({ response, version: state.version })
    )
  );
  const target = (exists: boolean, loads: typeof rows) =>
    Effect.succeed(
      exists
        ? Option.some({
            attempt: state.attempt,
            owner: "learner",
            section: record("section").pipe(
              Effect.as(
                Option.map(state.section, (deadline) => ({
                  deadline,
                  live: loads,
                  verify,
                }))
              )
            ),
          })
        : Option.none()
    );
  const gate = make({
    answer: (_live, answer, _now, version) =>
      record(
        `answer ${Option.match(answer, {
          onNone: () => "clear",
          onSome: ({ outcome }) => outcome.status,
        })} v${version}`
      ),
    finish: (_live, reason) => record(`finish ${reason}`),
    placement: (id: string) => target(id === "q", rows),
    section: (id: string) =>
      target(id === "s", Effect.succeed({ response, version: state.version })),
  });
  return { gate, log: Ref.get(log) };
});

/** Answers the question `q` with `optionKey` as the learner on no device, numbered `version`. */
const answer = (
  gate: Effect.Success<ReturnType<typeof memory>>["gate"],
  optionKey: Option.Option<string>,
  version: number
) =>
  gate.answer({
    device: Option.none(),
    owner: "learner",
    placement: "q",
    selection: Option.map(optionKey, (key) => ({
      kind: "single-choice",
      optionKey: key,
    })),
    version,
  });

/** One refused write: the first rule it fails, and the reads that happened before it. */
const Refused = Schema.Struct({
  expected: Schema.String,
  reads: Schema.Array(Schema.String),
  rule: Schema.Literals(["answer", "finish"]),
  state: Memory,
  target: Schema.String,
});

const refusals: readonly (typeof Refused.Type)[] = [
  {
    expected: "Missing",
    reads: [],
    rule: "answer",
    state: live,
    target: "nothing",
  },
  {
    expected: "AttemptClosed",
    reads: [],
    rule: "answer",
    state: Memory.make({
      ...attempt({ locked: true, open: false }),
      corrupt: true,
      section: Option.none(),
    }),
    target: "q",
  },
  {
    expected: "Locked",
    reads: [],
    rule: "answer",
    state: attempt({
      device: Option.some(DeviceId.make("device")),
      locked: true,
    }),
    target: "q",
  },
  {
    expected: "OtherDevice",
    reads: [],
    rule: "finish",
    state: attempt({
      deadline: NOW,
      device: Option.some(DeviceId.make("device")),
    }),
    target: "s",
  },
  {
    expected: "Expired",
    reads: [],
    rule: "finish",
    state: Memory.make({
      ...attempt({ deadline: NOW }),
      section: Option.none(),
    }),
    target: "s",
  },
  {
    expected: "SectionClosed",
    reads: ["section"],
    rule: "answer",
    state: Memory.make({
      ...attempt({ deadline: NOW }),
      corrupt: true,
      section: Option.none(),
    }),
    target: "q",
  },
  {
    expected: "Corrupt",
    reads: ["section"],
    rule: "answer",
    state: changed({ corrupt: true, section: Option.some(NOW) }),
    target: "q",
  },
  {
    expected: "Expired",
    reads: ["section"],
    rule: "answer",
    state: changed({ corruptRows: true, section: Option.some(NOW) }),
    target: "q",
  },
  {
    expected: "Corrupt",
    reads: ["section", "rows"],
    rule: "answer",
    state: changed({ corruptRows: true }),
    target: "q",
  },
];

/** A state in which a write is refused by a rule that comes before the version. */
const Superseded = Schema.Struct({
  expected: Schema.String,
  state: Memory,
});

const superseded: readonly (typeof Superseded.Type)[] = [
  {
    expected: "AttemptClosed",
    state: Memory.make({
      ...attempt({ open: false }),
      version: Option.some(2),
    }),
  },
  {
    expected: "SectionClosed",
    state: changed({ section: Option.none(), version: Option.some(2) }),
  },
  {
    expected: "Expired",
    state: changed({ section: Option.some(NOW), version: Option.some(2) }),
  },
];

/** A section's deadline against the server time, and how the finish ends it. */
const Ending = Schema.Struct({
  deadline: Schema.Finite,
  reason: Schema.Literals(["submitted", "time-expired"]),
});

const endings: readonly (typeof Ending.Type)[] = [
  { deadline: NOW + 1, reason: "submitted" },
  { deadline: NOW, reason: "time-expired" },
];

const setNow = TestClock.setTime(NOW);

describe("assessment/gate/admit", () => {
  it.effect("admits an answer, evaluates it, and writes it once", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate, log } = yield* memory(live);
      yield* answer(gate, Option.some("a"), 1);
      yield* answer(gate, Option.some("b"), 2);
      yield* answer(gate, Option.none(), 3);
      expect(yield* log).toEqual([
        "section",
        "rows",
        "answer correct v1",
        "section",
        "rows",
        "answer incorrect v2",
        "section",
        "rows",
        "answer clear v3",
      ]);
    })
  );
  it.effect(
    "rejects a selection the question does not have without writing",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(live);
        const rejected = yield* answer(gate, Option.some("z"), 1).pipe(
          Effect.flip
        );
        expect(rejected).toMatchObject({
          _tag: "ResponseRejected",
          reason: "selection",
        });
        expect(yield* log).toEqual(["section", "rows"]);
      })
  );
  it.effect.each(refusals)(
    "refuses with $expected before any later rule, reading $reads",
    ({ expected, reads, rule, state, target }) =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(state);
        const failure = yield* (
          rule === "answer"
            ? gate.answer({
                device: Option.none(),
                owner: "learner",
                placement: target,
                selection: Option.none(),
                version: 1,
              })
            : gate.finish({
                device: Option.none(),
                owner: "learner",
                section: target,
              })
        ).pipe(Effect.flip);
        expect(
          failure._tag === "AttemptRefused" ? failure.reason._tag : failure._tag
        ).toBe(expected);
        expect(yield* log).toEqual(reads);
      })
  );
  it.effect(
    "refuses another learner's target without reading its section",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(changed({ corrupt: true }));
        const failure = yield* gate
          .finish({ device: Option.none(), owner: "other", section: "s" })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: { _tag: "Missing" } });
        expect(yield* log).toEqual([]);
      })
  );
  it.effect("lets a lock refuse only a rule that refuses locked attempts", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate } = yield* memory(attempt({ locked: true }));
      const signal = Rule.make({ deadline: "live", lock: "admit" });
      const admitted = yield* gate.admit(
        signal,
        "learner",
        Option.none(),
        Effect.succeedSome({
          attempt: { ...live.attempt, locked: true },
          owner: "learner",
          section: Effect.succeedSome({
            deadline: NOW + 1,
            live: Effect.succeed("row"),
            verify: Effect.void,
          }),
        })
      );
      expect(admitted).toEqual({
        deadline: { attempt: NOW + HOUR, section: NOW + 1 },
        live: "row",
        now: NOW,
      });
      const refused = yield* answer(gate, Option.some("a"), 1).pipe(
        Effect.flip
      );
      expect(refused).toMatchObject({ reason: { _tag: "Locked" } });
    })
  );
  it.effect("admits a bound attempt only from its own device", () =>
    Effect.gen(function* () {
      yield* setNow;
      const device = DeviceId.make("device-a");
      const { gate, log } = yield* memory(
        attempt({ device: Option.some(device) })
      );
      for (const caller of [
        Option.none(),
        Option.some(DeviceId.make("device-b")),
      ]) {
        const refused = yield* gate
          .finish({ device: caller, owner: "learner", section: "s" })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ reason: { _tag: "OtherDevice" } });
      }
      yield* gate.finish({
        device: Option.some(device),
        owner: "learner",
        section: "s",
      });
      expect(yield* log).toEqual(["section", "finish submitted"]);
    })
  );
  it.effect(
    "refuses an answer whose version is not newer than the latest write without writing it",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(
          changed({ version: Option.some(2) })
        );
        for (const version of [1, 2]) {
          const refused = yield* answer(gate, Option.some("a"), version).pipe(
            Effect.flip
          );
          expect(refused).toMatchObject({ _tag: "Stale" });
        }
        yield* answer(gate, Option.some("b"), 3);
        expect(yield* log).toEqual([
          "section",
          "rows",
          "section",
          "rows",
          "section",
          "rows",
          "answer incorrect v3",
        ]);
      })
  );
  it.effect.each(superseded)(
    "refuses a stale answer with $expected, the rule that comes before the version",
    ({ expected, state }) =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate } = yield* memory(state);
        const refused = yield* answer(gate, Option.some("a"), 1).pipe(
          Effect.flip
        );
        expect(
          refused._tag === "AttemptRefused" ? refused.reason._tag : refused._tag
        ).toBe(expected);
      })
  );
  it.effect("refuses a stale answer before it evaluates the selection", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate, log } = yield* memory(changed({ version: Option.some(2) }));
      const refused = yield* answer(gate, Option.some("z"), 1).pipe(
        Effect.flip
      );
      expect(refused).toMatchObject({ _tag: "Stale" });
      expect(yield* log).toEqual(["section", "rows"]);
    })
  );
  it.effect.each(endings)(
    "finishes a section closing at $deadline as $reason",
    ({ deadline, reason }) =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(
          changed({ section: Option.some(deadline) })
        );
        yield* gate.finish({
          device: Option.none(),
          owner: "learner",
          section: "s",
        });
        expect(yield* log).toEqual(["section", `finish ${reason}`]);
      })
  );
});
