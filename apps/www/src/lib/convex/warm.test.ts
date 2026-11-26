import { afterEach, describe, expect, it } from "@effect/vitest";
import progress from "@repo/backend/confect/_generated/refs/progress";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { Effect, Fiber, MutableHashSet, MutableList, Option } from "effect";
import { TestClock } from "effect/testing";
import { WARM_HOLD, warmQuery } from "@/lib/convex/warm";

/** The client the page made, which each test sets: the warm reads it through `readMadeClient`. */
const made = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/lib/convex/client", () => ({ readMadeClient: made.read }));

/**
 * The part of the Convex client a warm reads, whose watch counts its open subscriptions. `held` is the answer the
 * client holds before the warm starts, `answer` gives every open subscription the server's answer, and a failed
 * answer makes the watch's local result throw, as Convex does for a query that failed.
 */
function client(held: "failure" | "none" | "value") {
  const open = MutableHashSet.empty<() => void>();
  let answer = held;
  const watched = MutableList.make<string>();
  const watchQuery = (query: FunctionReference<"query">) => {
    MutableList.append(watched, getFunctionName(query));
    return {
      journal: () => undefined,
      localQueryResult: () => {
        if (answer === "failure") {
          throw new Error("Refused by the test");
        }
        return answer === "value" ? { lifetime: 0 } : undefined;
      },
      onUpdate: (callback: () => void) => {
        MutableHashSet.add(open, callback);
        return () => {
          MutableHashSet.remove(open, callback);
        };
      },
    };
  };
  made.read.mockReturnValue(Option.some({ watchQuery }));
  return {
    answer: () => {
      answer = "value";
      for (const callback of open) {
        callback();
      }
    },
    open: () => MutableHashSet.size(open),
    watched: () => MutableList.toArray(watched),
  };
}

describe("warmQuery", () => {
  afterEach(() => {
    made.read.mockReset();
  });

  it.effect("warms nothing on a page that made no client", () =>
    Effect.gen(function* () {
      made.read.mockReturnValue(Option.none());
      expect(yield* warmQuery(progress.queries.growth, {})).toEqual(
        Option.none()
      );
    })
  );

  it.effect(
    "ends when the server answers, and keeps the subscription for its hold",
    () =>
      Effect.gen(function* () {
        const convex = client("none");
        const fiber = yield* Effect.forkChild(
          warmQuery(progress.queries.growth, {})
        );
        yield* Effect.yieldNow;
        expect(convex.watched()).toEqual([
          progress.queries.growth.convexFunctionName,
        ]);
        expect(fiber.pollUnsafe()).toBeUndefined();

        convex.answer();
        expect(yield* Fiber.join(fiber)).toEqual(Option.some({ lifetime: 0 }));
        expect(convex.open()).toBe(1);

        yield* TestClock.adjust(WARM_HOLD);
        expect(convex.open()).toBe(0);
      })
  );

  it.effect("ends at once for an answer the client already holds", () =>
    Effect.gen(function* () {
      const valueClient = client("value");
      expect(yield* warmQuery(progress.queries.growth, {})).toEqual(
        Option.some({ lifetime: 0 })
      );
      expect(valueClient.open()).toBe(1);

      const failureClient = client("failure");
      expect(yield* warmQuery(progress.queries.growth, {})).toEqual(
        Option.none()
      );
      expect(failureClient.open()).toBe(1);
    })
  );
});
