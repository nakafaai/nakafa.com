import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/assessment/gate/admit";
import { Rule } from "@repo/backend/confect/assessment/gate/rules";
import { Attempt } from "@repo/backend/confect/assessment/gate/store";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

const NOW = 1_000_000;
const HOUR = 3_600_000;

/** A failure of the in-memory store's own integrity checks. */
class Corrupt extends Schema.TaggedError<Corrupt>()("Corrupt", {}) {}

/**
 * The in-memory store's one attempt: its attempt stage, its running section's deadline
 * (none once it ended or before it started), whether the section's rows fail the store's
 * checks before the deadline and whether the question's stored rows fail them after it,
 * and the version of the question's latest write.
 */
const Memory = Schema.Struct({
  attempt: Attempt,
  corrupt: Schema.Boolean,
  corruptRows: Schema.Boolean,
  section: Schema.Option(Schema.Finite),
  version: Schema.Option(Schema.Int),
});
type Memory = typeof Memory.Type;

/** A learner's free attempt in progress, with a running section, both closing in an hour. */
const live = Memory.make({
  attempt: {
    binding: { kind: "free" },
    deadline: NOW + HOUR,
    state: "inProgress",
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

/** The attempt bound to one device session. */
const bound = (device: string) => ({
  binding: { device, kind: "bound" as const, retired: [] },
});

/**
 * Builds the gate over one in-memory attempt that the learner owns: the question `q`
 * and the section `s` exist. Every section read, every read of the question's stored
 * rows, and every write is appended to the returned log.
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
        : Effect.succeed({ version: state.version })
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
    answer: (_live, value: string, _now, version) =>
      record(`answer ${value} v${version}`),
    finish: (_live, reason) => record(`finish ${reason}`),
    placement: (id: string) => target(id === "q", rows),
    section: (id: string) =>
      target(id === "s", Effect.succeed({ version: state.version })),
  });
  return { gate, log: Ref.get(log) };
});

/** Answers the question `q` with `value` as the learner on `device`, numbered `version`. */
const answer = (
  gate: Effect.Success<ReturnType<typeof memory>>["gate"],
  value: string,
  version: number,
  device: Option.Option<string> = Option.none()
) =>
  gate.answer({
    device,
    owner: "learner",
    placement: "q",
    value: () => Effect.succeed(value),
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
      ...attempt({ state: "closing" }),
      corrupt: true,
      section: Option.none(),
    }),
    target: "q",
  },
  {
    expected: "Locked",
    reads: [],
    rule: "answer",
    state: attempt({ ...bound("device"), state: "locked" }),
    target: "q",
  },
  {
    expected: "OtherDevice",
    reads: [],
    rule: "finish",
    state: attempt({ ...bound("device"), deadline: NOW }),
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
      ...attempt({ state: "submitted" }),
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
  it.effect("writes each admitted answer with its value and version", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate, log } = yield* memory(live);
      yield* answer(gate, "a", 1);
      yield* answer(gate, "b", 2);
      expect(yield* log).toEqual([
        "section",
        "rows",
        "answer a v1",
        "section",
        "rows",
        "answer b v2",
      ]);
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
                value: () => Effect.succeed("a"),
                version: 1,
              })
            : gate.finish({
                device: Option.none(),
                owner: Option.some("learner"),
                section: target,
                settled: "refuse",
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
          .finish({
            device: Option.none(),
            owner: Option.some("other"),
            section: "s",
            settled: "refuse",
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: { _tag: "Missing" } });
        expect(yield* log).toEqual([]);
      })
  );
  it.effect("lets a lock refuse only a rule that refuses locked attempts", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate } = yield* memory(attempt({ state: "locked" }));
      const admitRule = Rule.make({ deadline: "live", lock: "admit" });
      const admitted = yield* gate.admit(
        admitRule,
        Option.some("learner"),
        Option.none(),
        Effect.succeedSome({
          attempt: { ...live.attempt, state: "locked" },
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
      const refused = yield* answer(gate, "a", 1).pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: { _tag: "Locked" } });
    })
  );
  it.effect("admits a bound attempt only from its own device", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate, log } = yield* memory(attempt(bound("device-a")));
      for (const caller of [Option.none(), Option.some("device-b")]) {
        const refused = yield* gate
          .finish({
            device: caller,
            owner: Option.some("learner"),
            section: "s",
            settled: "refuse",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ reason: { _tag: "OtherDevice" } });
      }
      yield* gate.finish({
        device: Option.some("device-a"),
        owner: Option.some("learner"),
        section: "s",
        settled: "refuse",
      });
      expect(yield* log).toEqual(["section", "finish submitted"]);
    })
  );
  it.effect("refuses a retired device before any other device rule", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate, log } = yield* memory(
        attempt({
          binding: { kind: "unbound", retired: ["old-device"] },
        })
      );
      const refused = yield* gate
        .finish({
          device: Option.some("old-device"),
          owner: Option.some("learner"),
          section: "s",
          settled: "refuse",
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: { _tag: "DeviceRetired" } });
      const unbound = yield* gate
        .finish({
          device: Option.some("new-device"),
          owner: Option.some("learner"),
          section: "s",
          settled: "refuse",
        })
        .pipe(Effect.flip);
      expect(unbound).toMatchObject({ reason: { _tag: "OtherDevice" } });
      expect(yield* log).toEqual([]);
    })
  );
  it.effect(
    "writes nothing when a finish finds its section already submitted",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(
          attempt({ ...bound("device-a"), state: "submitted" })
        );
        yield* gate.finish({
          device: Option.some("device-a"),
          owner: Option.some("learner"),
          section: "s",
          settled: "answer",
        });
        expect(yield* log).toEqual([]);
      })
  );
  it.effect(
    "refuses a repeated finish as closed when the caller refuses settled finishes",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate, log } = yield* memory(
          attempt({ ...bound("device-a"), state: "submitted" })
        );
        const refused = yield* gate
          .finish({
            device: Option.some("device-a"),
            owner: Option.some("learner"),
            section: "s",
            settled: "refuse",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ reason: { _tag: "AttemptClosed" } });
        expect(yield* log).toEqual([]);
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
          const refused = yield* answer(gate, "a", version).pipe(Effect.flip);
          expect(refused).toMatchObject({ _tag: "Stale" });
        }
        yield* answer(gate, "b", 3);
        expect(yield* log).toEqual([
          "section",
          "rows",
          "section",
          "rows",
          "section",
          "rows",
          "answer b v3",
        ]);
      })
  );
  it.effect.each(superseded)(
    "refuses a stale answer with $expected, the rule that comes before the version",
    ({ expected, state }) =>
      Effect.gen(function* () {
        yield* setNow;
        const { gate } = yield* memory(state);
        const refused = yield* answer(gate, "a", 1).pipe(Effect.flip);
        expect(
          refused._tag === "AttemptRefused" ? refused.reason._tag : refused._tag
        ).toBe(expected);
      })
  );
  it.effect("refuses a stale answer before it writes the value", () =>
    Effect.gen(function* () {
      yield* setNow;
      const { gate, log } = yield* memory(changed({ version: Option.some(2) }));
      const refused = yield* answer(gate, "z", 1).pipe(Effect.flip);
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
          owner: Option.some("learner"),
          section: "s",
          settled: "refuse",
        });
        expect(yield* log).toEqual(["section", `finish ${reason}`]);
      })
  );
});
