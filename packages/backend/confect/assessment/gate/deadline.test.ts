import { describe, expect, it } from "@effect/vitest";
import {
  DEADLINE_GRACE_MS,
  isDue,
  sweepOverdue,
} from "@repo/backend/confect/assessment/gate/deadline";
import type { AttemptState } from "@repo/backend/confect/assessment/gate/store";
import { Array as Arr, Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

describe("assessment/gate/deadline", () => {
  it("finds a step due only for an attempt that still takes writes once its deadline passed", () => {
    const states: readonly AttemptState[] = [
      "inProgress",
      "locked",
      "closing",
      "submitted",
      "expired",
    ];
    expect(
      Arr.map(states, (state) => [
        isDue({ deadline: 100, state }, 99),
        isDue({ deadline: 100, state }, 100),
      ])
    ).toEqual([
      [false, true],
      [false, true],
      [false, false],
      [false, false],
      [false, false],
    ]);
  });

  it.effect(
    "asks every kind for its rows due by the grace before now, in order",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(5 * DEADLINE_GRACE_MS);
        const asked = yield* Ref.make<readonly string[]>([]);
        const kind = (name: string) => (upTo: number) =>
          Ref.update(asked, (seen) => [...seen, `${name}:${upTo}`]);
        yield* sweepOverdue([kind("attempts"), kind("sections")]);
        expect(yield* Ref.get(asked)).toEqual([
          `attempts:${4 * DEADLINE_GRACE_MS}`,
          `sections:${4 * DEADLINE_GRACE_MS}`,
        ]);
      })
  );
});
