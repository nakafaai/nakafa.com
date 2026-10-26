import { describe, expect, it } from "@effect/vitest";
import { PRESENCE_INTERVAL } from "@repo/backend/confect/exams/presence";
import { Data, Deferred, Effect, Exit, Fiber, MutableList } from "effect";
import { TestClock } from "effect/testing";
import {
  makeHeartbeat,
  RETURN_DELAY,
} from "@/components/tenant/exams/heartbeat";

/** A join that the server refused. */
class JoinRefused extends Data.TaggedError("JoinRefused") {}

/**
 * A room that records each call the heartbeat makes, in order, and answers each join with a
 * token of its own. The tab shows until a test hides it, and a join refuses once a test says so.
 */
function room() {
  const made = MutableList.make<string>();
  const tab = { refuses: false, visible: true };
  let joins = 0;
  return {
    /** The calls made so far, read when the test asks. */
    calls: () => MutableList.toArray(made),
    tab,
    heartbeat: makeHeartbeat({
      isVisible: () => tab.visible,
      join: (session) =>
        Effect.suspend(() => {
          if (tab.refuses) {
            return Effect.fail(new JoinRefused());
          }
          joins += 1;
          MutableList.append(made, `join ${session.length}`);
          return Effect.succeed(`token-${joins}`);
        }),
      leave: (token) =>
        Effect.sync(() => MutableList.append(made, `leave ${token}`)),
    }),
  };
}

describe("tenant/exams/heartbeat makeHeartbeat", () => {
  it.effect(
    "joins at once and keeps the session every interval, then leaves with the last token when it ends",
    () =>
      Effect.gen(function* () {
        const { calls, heartbeat } = room();
        const presence = yield* heartbeat;
        const running = yield* Effect.forkChild(presence.run);
        yield* Effect.yieldNow;
        expect(calls()).toEqual(["join 36"]);
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        expect(calls()).toEqual(["join 36", "join 36", "join 36"]);
        yield* Fiber.interrupt(running);
        expect(calls()).toEqual([
          "join 36",
          "join 36",
          "join 36",
          "leave token-3",
        ]);
      })
  );

  it.effect(
    "leaves at the first beat the tab is hidden, and joins again once it has shown for the return delay",
    () =>
      Effect.gen(function* () {
        const { calls, heartbeat, tab } = room();
        const presence = yield* heartbeat;
        yield* Effect.forkChild(presence.run);
        yield* Effect.yieldNow;
        tab.visible = false;
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        expect(calls()).toEqual(["join 36", "leave token-1"]);
        tab.visible = true;
        yield* Effect.forkChild(presence.returned);
        yield* Effect.forkChild(presence.returned);
        yield* Effect.yieldNow;
        expect(calls()).toEqual(["join 36", "leave token-1"]);
        yield* TestClock.adjust(RETURN_DELAY);
        expect(calls()).toEqual(["join 36", "leave token-1", "join 36"]);
      })
  );

  it.effect(
    "joins nothing for a tab that shows and hides again within the return delay, as one shown only to be closed",
    () =>
      Effect.gen(function* () {
        const { calls, heartbeat, tab } = room();
        const presence = yield* heartbeat;
        yield* Effect.forkChild(presence.run);
        yield* Effect.yieldNow;
        tab.visible = false;
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        tab.visible = true;
        yield* Effect.forkChild(presence.returned);
        yield* Effect.yieldNow;
        tab.visible = false;
        yield* TestClock.adjust(RETURN_DELAY);
        expect(calls()).toEqual(["join 36", "leave token-1"]);
      })
  );

  it.effect(
    "closes the session at once when the page goes away, and the next beat joins again",
    () =>
      Effect.gen(function* () {
        const { calls, heartbeat } = room();
        const presence = yield* heartbeat;
        yield* Effect.forkChild(presence.run);
        yield* Effect.yieldNow;
        yield* presence.leave;
        yield* presence.leave;
        expect(calls()).toEqual(["join 36", "leave token-1"]);
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        expect(calls()).toEqual(["join 36", "leave token-1", "join 36"]);
      })
  );

  it.effect(
    "ends with the refusal of a join, leaves the session it held, and joins no more when the tab shows",
    () =>
      Effect.gen(function* () {
        const { calls, heartbeat, tab } = room();
        const presence = yield* heartbeat;
        const ended = yield* Deferred.make<Exit.Exit<void, JoinRefused>>();
        yield* Effect.forkChild(
          presence.run.pipe(
            Effect.exit,
            Effect.flatMap((exit) => Deferred.succeed(ended, exit))
          )
        );
        yield* Effect.yieldNow;
        tab.refuses = true;
        yield* TestClock.adjust(PRESENCE_INTERVAL);
        const exit = yield* Deferred.await(ended);
        expect(Exit.isFailure(exit)).toBe(true);
        expect(calls()).toEqual(["join 36", "leave token-1"]);
        tab.refuses = false;
        yield* Effect.forkChild(presence.returned);
        yield* TestClock.adjust(RETURN_DELAY);
        expect(calls()).toEqual(["join 36", "leave token-1"]);
      })
  );
});
