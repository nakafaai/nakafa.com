import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger, MutableList } from "effect";
import {
  logRouteFailures,
  type RouteMatchFacts,
} from "@/lib/routing/failures.server";

/** Runs the log with a logger that keeps each message, and returns the kept messages. */
function collectLogs(matches: readonly RouteMatchFacts[]) {
  const messages = MutableList.make<unknown>();
  return Effect.gen(function* () {
    yield* logRouteFailures(matches).pipe(
      Effect.provide(
        Logger.layer([
          Logger.make(({ message }) => {
            MutableList.append(messages, message);
          }),
        ])
      )
    );
    return MutableList.toArray(messages);
  });
}

describe("route failure log", () => {
  it.effect("logs each failed route with its error and nothing else", () =>
    Effect.gen(function* () {
      const cause = new Error("loader failed");
      const messages = yield* collectLogs([
        { error: undefined, routeId: "/$locale/", status: "success" },
        { error: cause, routeId: "/$locale/pricing", status: "error" },
      ]);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toStrictEqual(
        expect.arrayContaining(["/$locale/pricing", cause])
      );
    })
  );

  it.effect("logs nothing when every route loaded", () =>
    Effect.gen(function* () {
      const messages = yield* collectLogs([
        { error: undefined, routeId: "/", status: "success" },
      ]);

      expect(messages).toStrictEqual([]);
    })
  );
});
