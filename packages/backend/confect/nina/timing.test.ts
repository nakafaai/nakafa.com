import { describe, expect, it } from "@effect/vitest";
import { makeTiming, sinceAdmission } from "@repo/backend/confect/nina/timing";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

const turn = { _creationTime: 0 };

describe("the waits of a turn", () => {
  it("counts from the creation of the turn and never below zero", () => {
    expect(sinceAdmission({ _creationTime: 1000 }, 4500)).toBe(3500);
    expect(sinceAdmission({ _creationTime: 1000 }, 900)).toBe(0);
  });

  it.effect(
    "stores the first sign of work before the first word, each once",
    () =>
      Effect.gen(function* () {
        const timing = yield* makeTiming(turn);
        yield* TestClock.adjust("2 seconds");
        timing.reach("readyMs");
        yield* TestClock.adjust("3 seconds");
        timing.observe({ type: "reasoning-start", id: "reason" });
        yield* TestClock.adjust("4 seconds");
        timing.observe({ type: "text-start", id: "answer" });
        timing.observe({ type: "text-delta", id: "answer", text: "A limit" });
        yield* TestClock.adjust("5 seconds");
        timing.observe({ type: "reasoning-start", id: "again" });
        timing.observe({ type: "text-delta", id: "answer", text: " is." });
        timing.reach("readyMs");

        // The model's reasoning came at 5 seconds and its first word at 9.
        // Later parts, and a second readiness, change nothing.
        expect(yield* timing.read).toEqual({
          readyMs: 2000,
          progressMs: 5000,
          tokenMs: 9000,
        });
      })
  );

  it.effect("counts a capability row as the first sign of work", () =>
    Effect.gen(function* () {
      const timing = yield* makeTiming(turn);
      yield* TestClock.adjust("6 seconds");
      timing.observe({
        type: "tool-input-start",
        id: "call",
        toolName: "math",
      });
      yield* TestClock.adjust("1 seconds");
      timing.observe({
        type: "tool-call",
        toolCallId: "call",
        toolName: "math",
        input: {},
      });

      expect(yield* timing.read).toEqual({ progressMs: 6000 });
    })
  );

  it.effect("counts a capability call that arrives whole", () =>
    Effect.gen(function* () {
      const timing = yield* makeTiming(turn);
      yield* TestClock.adjust("7 seconds");
      timing.observe({
        type: "tool-call",
        toolCallId: "call",
        toolName: "math",
        input: {},
      });

      expect(yield* timing.read).toEqual({ progressMs: 7000 });
    })
  );

  it.effect("ignores what the page does not show", () =>
    Effect.gen(function* () {
      const timing = yield* makeTiming(turn);
      yield* TestClock.adjust("1 seconds");
      timing.observe({ type: "start" });
      timing.observe({ type: "text-start", id: "answer" });
      // An empty text part is hidden, and so is one that holds only spacing.
      timing.observe({ type: "text-delta", id: "answer", text: "" });
      timing.observe({ type: "text-delta", id: "answer", text: " \n" });

      expect(yield* timing.read).toEqual({});
    })
  );
});
