// @vitest-environment node

import { HttpClient } from "@confect/js";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Duration, Effect, Exit, Fiber, Layer, Logger } from "effect";
import { TestClock } from "effect/testing";
import {
  httpLayer,
  isTransientQueryFailure,
  withQueryRetry,
} from "@/lib/convex/http";

const DEPLOYMENT_URL = "https://example.convex.cloud";

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud" },
}));

const queryMock = vi.hoisted(() => vi.fn());
const mutationMock = vi.hoisted(() => vi.fn());

/** A real client whose query and mutation answers come from the test. */
const scripted = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(HttpClient.HttpClient, (client) => ({
    ...client,
    mutation: mutationMock,
    query: queryMock,
  }))
).pipe(Layer.provide(HttpClient.layer(DEPLOYMENT_URL)));

/** A request Convex refused with one HTTP API error code. */
function refused(code: string) {
  return new HttpClient.HttpClientError({
    cause: new Error(JSON.stringify({ code, message: "Try again later." })),
  });
}

/** A connection that closed before Convex answered, as Undici reports it. */
function dropped() {
  return new HttpClient.HttpClientError({
    cause: new TypeError("terminated", {
      cause: Object.assign(new Error("other side closed"), {
        code: "UND_ERR_SOCKET",
      }),
    }),
  });
}

/**
 * One lazy query, like Confect's: each run sends a new request and receives
 * the next scripted outcome.
 */
function scriptQuery(...outcomes: Effect.Effect<unknown, unknown>[]) {
  let runs = 0;
  queryMock.mockReturnValueOnce(
    Effect.suspend(() => {
      runs += 1;
      return outcomes[Math.min(runs, outcomes.length) - 1] ?? Effect.void;
    })
  );
  return { runs: () => runs };
}

/** Runs one query through the retrying client while test time passes. */
function runQuery(messages: unknown[] = []) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(
      Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.query(refs.public.contentRelease.quran.surahs, {})
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            withQueryRetry(scripted),
            Logger.layer([
              Logger.make(({ message }) => {
                messages.push(message);
              }),
            ])
          )
        ),
        Effect.exit
      )
    );
    yield* TestClock.adjust(Duration.seconds(2));
    return yield* Fiber.join(fiber);
  });
}

afterEach(() => {
  queryMock.mockReset();
  mutationMock.mockReset();
});

describe("Convex HTTP query retries", () => {
  it.effect("retries queries Convex refused or never answered", () =>
    Effect.gen(function* () {
      const query = scriptQuery(
        Effect.fail(refused("ExpiredInQueue")),
        Effect.fail(dropped()),
        Effect.succeed("surahs")
      );

      expect(yield* runQuery()).toStrictEqual(Exit.succeed("surahs"));
      expect(query.runs()).toBe(3);
    })
  );

  it.effect("fails with the original error once retries run out", () =>
    Effect.gen(function* () {
      const failure = refused("ServiceUnavailable");
      const query = scriptQuery(Effect.fail(failure));
      const messages: unknown[] = [];

      expect(yield* runQuery(messages)).toStrictEqual(Exit.fail(failure));
      expect(query.runs()).toBe(3);
      expect(messages).toEqual([["A Convex query failed after its retries."]]);
    })
  );

  it.effect("returns other failures at once without logging", () =>
    Effect.gen(function* () {
      const failure = refused("Unauthenticated");
      const query = scriptQuery(Effect.fail(failure));
      const messages: unknown[] = [];

      expect(yield* runQuery(messages)).toStrictEqual(Exit.fail(failure));
      expect(query.runs()).toBe(1);
      expect(messages).toEqual([]);
    })
  );

  it.effect("passes mutations through without retrying", () =>
    Effect.gen(function* () {
      const failure = refused("ExpiredInQueue");
      mutationMock.mockReturnValueOnce(Effect.fail(failure));

      const exit = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.mutation(refs.public.onboarding.mutations.admit, {})
      ).pipe(Effect.provide(withQueryRetry(scripted)), Effect.exit);

      expect(exit).toStrictEqual(Exit.fail(failure));
      expect(mutationMock).toHaveBeenCalledTimes(1);
    })
  );
});

describe("transient query failures", () => {
  it("accepts only refusals and dropped connections from the client", () => {
    expect(
      [
        refused("ExpiredInQueue"),
        refused("ServiceUnavailable"),
        dropped(),
        refused("InternalServerError"),
        new HttpClient.HttpClientError({ cause: new Error("Bad request") }),
        new HttpClient.HttpClientError({ cause: "closed" }),
        new Error(JSON.stringify({ code: "ExpiredInQueue" })),
        { _tag: "HttpClientError", cause: dropped().cause },
      ].map(isTransientQueryFailure)
    ).toEqual([true, true, true, false, false, false, false, false]);
  });
});

describe("deployment client", () => {
  it.effect("targets this deployment with or without authentication", () =>
    Effect.gen(function* () {
      const read = Effect.map(HttpClient.HttpClient, (client) => client.url);

      expect([
        yield* read.pipe(Effect.provide(httpLayer())),
        yield* read.pipe(Effect.provide(httpLayer({ auth: "session-token" }))),
      ]).toEqual([DEPLOYMENT_URL, DEPLOYMENT_URL]);
    })
  );
});
