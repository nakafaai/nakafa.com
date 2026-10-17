import { expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import chats from "@repo/backend/confect/_generated/refs/chats";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { Effect, Exit, Fiber, MutableHashSet, Schema, Scope } from "effect";
import { awaitServerAnswer } from "@/lib/convex/answer";

const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");

/**
 * The part of the Convex client that the wait reads, with a watch that counts
 * its open subscriptions. `answer` gives every open subscription the server's
 * answer. A failed answer makes the watch's reads throw, as Convex does for a
 * query that failed.
 */
function client(outcome: "value" | "failure" = "value") {
  const open = MutableHashSet.empty<() => void>();
  let watchedName = "";
  let watchedArgs: readonly unknown[] = [];
  const watchQuery: ConvexReactClient["watchQuery"] = (query, ...args) => {
    watchedName = getFunctionName(query);
    watchedArgs = args;
    return {
      journal: () => undefined,
      localQueryResult: () => {
        if (outcome === "failure") {
          throw new Error("Refused by the test");
        }
      },
      onUpdate: (callback) => {
        MutableHashSet.add(open, callback);
        return () => {
          MutableHashSet.remove(open, callback);
        };
      },
    };
  };
  return {
    answer: () => {
      for (const callback of open) {
        callback();
      }
    },
    open: () => MutableHashSet.size(open),
    watched: () => ({ args: watchedArgs, name: watchedName }),
    watchQuery,
  };
}

it.effect("ends the wait only when the server answers", () =>
  Effect.gen(function* () {
    const convex = client();
    const scope = yield* Scope.make();
    const fiber = yield* Effect.forkChild(
      awaitServerAnswer(convex, chats.queries.getShareToken, { chatId }).pipe(
        Scope.provide(scope)
      )
    );
    yield* Effect.yieldNow;
    expect(convex.open()).toBe(1);
    expect(fiber.pollUnsafe()).toBeUndefined();

    convex.answer();
    yield* Fiber.join(fiber);
    yield* Scope.close(scope, Exit.void);
  })
);

it.effect(
  "holds its subscription after the answer until the scope closes",
  () =>
    Effect.gen(function* () {
      const convex = client();
      const scope = yield* Scope.make();
      const fiber = yield* Effect.forkChild(
        awaitServerAnswer(convex, chats.queries.getShareToken, { chatId }).pipe(
          Scope.provide(scope)
        )
      );
      yield* Effect.yieldNow;
      convex.answer();
      yield* Fiber.join(fiber);

      expect(convex.open()).toBe(1);
      yield* Scope.close(scope, Exit.void);
      expect(convex.open()).toBe(0);
    })
);

it.effect("ends the wait on a failed answer too", () =>
  Effect.gen(function* () {
    const convex = client("failure");
    const scope = yield* Scope.make();
    const fiber = yield* Effect.forkChild(
      awaitServerAnswer(convex, chats.queries.getShareToken, { chatId }).pipe(
        Scope.provide(scope)
      )
    );
    yield* Effect.yieldNow;
    convex.answer();
    yield* Fiber.join(fiber);

    expect(convex.open()).toBe(1);
    yield* Scope.close(scope, Exit.void);
  })
);

it.effect(
  "releases its subscription when the scoped call is interrupted before the answer",
  () =>
    Effect.gen(function* () {
      const convex = client();
      const fiber = yield* Effect.forkChild(
        Effect.scoped(
          awaitServerAnswer(convex, chats.queries.getShareToken, { chatId })
        )
      );
      yield* Effect.yieldNow;
      expect(convex.open()).toBe(1);

      yield* Fiber.interrupt(fiber);
      expect(convex.open()).toBe(0);
    })
);

it.effect("watches the share token query with the chat", () =>
  Effect.gen(function* () {
    const convex = client();
    const scope = yield* Scope.make();
    const fiber = yield* Effect.forkChild(
      awaitServerAnswer(convex, chats.queries.getShareToken, { chatId }).pipe(
        Scope.provide(scope)
      )
    );
    yield* Effect.yieldNow;

    expect(convex.watched()).toEqual({
      args: [{ chatId: "chat_1" }],
      name: "chats/queries:getShareToken",
    });
    convex.answer();
    yield* Fiber.join(fiber);
    yield* Scope.close(scope, Exit.void);
  })
);
