import { describe, expect, it } from "@effect/vitest";
import {
  type Entrance,
  makeEntry,
} from "@repo/backend/confect/assessment/gate/enter";
import {
  TokenRefused,
  TooManyTries,
} from "@repo/backend/confect/assessment/gate/refusal";
import { Attempt } from "@repo/backend/confect/assessment/gate/store";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

const NOW = 1_000_000;
const HOUR = 3_600_000;

/** One target of the in-memory store: whether the caller holds an attempt in it, and what it accepts. */
const Target = Schema.Struct({
  held: Schema.Option(Schema.Struct({ ...Attempt.fields, _id: Schema.String })),
  locked: Schema.Boolean,
  state: Schema.Literals(["scheduled", "open", "closed"]),
  token: Schema.Literals(["right", "wrong", "tooMany"]),
});
type Target = typeof Target.Type;

const open = (target: Partial<Target> = {}): Target => ({
  held: Option.none(),
  locked: false,
  state: "open",
  token: "right",
  ...target,
});

/** A held attempt in progress, bound to `device`. */
const heldBy = (
  device: string,
  fields: Partial<Attempt & { _id: string }> = {}
) => ({
  _id: "attempt",
  binding: { device, kind: "bound" as const, retired: [] },
  deadline: NOW + HOUR,
  state: "inProgress" as const,
  ...fields,
});

/** The outcome of one token check: admitted, a token that does not match, or no tries left. */
const verdict = (
  token: Target["token"]
): Effect.Effect<void, TokenRefused | TooManyTries> => {
  if (token === "right") {
    return Effect.void;
  }
  if (token === "wrong") {
    return Effect.fail(new TokenRefused());
  }
  return Effect.fail(new TooManyTries());
};

/**
 * Builds the entry gate over one in-memory target. The log records every store call, so
 * a test can check which calls the gate made before it refused.
 */
const entry = (target: Target) =>
  Effect.gen(function* () {
    const log = yield* Ref.make<readonly string[]>([]);
    const record = (entry: string) => Ref.update(log, Arr.append(entry));
    const { enter } = makeEntry<
      string,
      Attempt & { readonly _id: string },
      { readonly id: string },
      { readonly outcome: string; readonly now: number },
      never,
      never
    >({
      bind: (held, device, now) =>
        record(`bind ${device}`).pipe(
          Effect.as({ outcome: "bound", now, attempt: held._id })
        ),
      entrance: () =>
        Effect.succeedSome<
          Entrance<{ readonly id: string }, Attempt & { readonly _id: string }>
        >({
          held: target.held,
          locked: target.locked,
          sitting: { id: "sitting" },
          window: { closesAt: NOW + HOUR, state: target.state },
        }),
      resume: (held, now) =>
        record("resume").pipe(
          Effect.as({ outcome: "resumed", now, attempt: held._id })
        ),
      start: (_target, _sitting, device, now) =>
        record(`start ${device}`).pipe(Effect.as({ outcome: "started", now })),
      verify: (_target, _sitting, device) =>
        record(`verify ${device}`).pipe(Effect.andThen(verdict(target.token))),
    });
    return { enter, log: Ref.get(log) };
  });

const enterWith = (
  gate: Effect.Success<ReturnType<typeof entry>>["enter"],
  device = "device-a"
) => gate({ device, target: "target", token: "K7Q4XM" });

describe("assessment/gate/enter", () => {
  it.effect("refuses a target the caller may not enter", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { enter } = makeEntry<
        string,
        Attempt & { readonly _id: string },
        { readonly id: string },
        { readonly outcome: string; readonly now: number },
        never,
        never
      >({
        bind: () => Effect.die("unused"),
        entrance: () => Effect.succeedNone,
        resume: () => Effect.die("unused"),
        start: () => Effect.die("unused"),
        verify: () => Effect.die("unused"),
      });
      const failure = yield* enterWith(enter).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: { _tag: "Missing" } });
    })
  );
  it.effect("refuses an entry to a locked place without a token check", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { enter, log } = yield* entry(open({ locked: true }));
      const failure = yield* enterWith(enter).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: { _tag: "PlaceLocked" } });
      expect(yield* log).toEqual([]);
    })
  );
  it.effect("refuses a held attempt that is closed or past its deadline", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      for (const fields of [{ state: "closing" as const }, { deadline: NOW }]) {
        const { enter, log } = yield* entry(
          open({ held: Option.some(heldBy("device-a", fields)) })
        );
        const failure = yield* enterWith(enter).pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: { _tag: "AttemptClosed" } });
        expect(yield* log).toEqual([]);
      }
    })
  );
  it.effect("admits the device that owns the attempt without a token", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { enter, log } = yield* entry(
        open({ held: Option.some(heldBy("device-a")) })
      );
      const admitted = yield* enterWith(enter);
      expect(admitted).toEqual({
        attempt: "attempt",
        now: NOW,
        outcome: "resumed",
      });
      expect(yield* log).toEqual(["resume"]);
    })
  );
  it.effect("refuses a retired device before it checks any token", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { enter, log } = yield* entry(
        open({
          held: Option.some({
            ...heldBy("device-a"),
            binding: { kind: "unbound", retired: ["device-z"] },
          }),
        })
      );
      const failure = yield* enterWith(enter, "device-z").pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: { _tag: "DeviceRetired" } });
      expect(yield* log).toEqual([]);
    })
  );
  it.effect(
    "refuses an unscheduled, closed, or ended window with its reason",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const cases = [
          { reason: "NotOpen", state: "scheduled" as const },
          { reason: "Closed", state: "closed" as const },
        ];
        for (const { reason, state } of cases) {
          const { enter, log } = yield* entry(open({ state }));
          const failure = yield* enterWith(enter).pipe(Effect.flip);
          expect(failure).toMatchObject({ reason: { _tag: reason } });
          expect(yield* log).toEqual([]);
        }
      })
  );
  it.effect("refuses a new entry once the window has reached its close", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW + HOUR);
      const { enter, log } = yield* entry(open());
      const failure = yield* enterWith(enter).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: { _tag: "Closed" } });
      expect(yield* log).toEqual([]);
    })
  );
  it.effect("starts an attempt with the device once the token matches", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { enter, log } = yield* entry(open());
      const started = yield* enterWith(enter);
      expect(started).toEqual({ now: NOW, outcome: "started" });
      expect(yield* log).toEqual(["verify device-a", "start device-a"]);
    })
  );
  it.effect(
    "refuses a token that does not match, or too many tries, without starting",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const wrong = yield* entry(open({ token: "wrong" }));
        expect(yield* enterWith(wrong.enter).pipe(Effect.flip)).toBeInstanceOf(
          TokenRefused
        );
        expect(yield* wrong.log).toEqual(["verify device-a"]);
        const tooMany = yield* entry(open({ token: "tooMany" }));
        expect(
          yield* enterWith(tooMany.enter).pipe(Effect.flip)
        ).toBeInstanceOf(TooManyTries);
        expect(yield* tooMany.log).toEqual(["verify device-a"]);
      })
  );
  it.effect(
    "binds an unbound attempt to the device once the token matches",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { enter, log } = yield* entry(
          open({
            held: Option.some({
              ...heldBy("device-a"),
              binding: { kind: "unbound", retired: [] },
            }),
          })
        );
        const bound = yield* enterWith(enter);
        expect(bound).toEqual({
          attempt: "attempt",
          now: NOW,
          outcome: "bound",
        });
        expect(yield* log).toEqual(["verify device-a", "bind device-a"]);
      })
  );
  it.effect(
    "refuses another device's attempt after the token, not before",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { enter, log } = yield* entry(
          open({ held: Option.some(heldBy("device-a")) })
        );
        const failure = yield* enterWith(enter, "device-b").pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: { _tag: "OtherDevice" } });
        expect(yield* log).toEqual(["verify device-b"]);
      })
  );
});
