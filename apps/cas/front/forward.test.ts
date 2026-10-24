import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, MutableList, Result } from "effect";
import { TestClock } from "effect/testing";
import {
  CasEngineFailed,
  CasEngineTimedOut,
  type CasSolverNamespace,
  forwardMath,
} from "@/front/forward";

const POOLED_NAME = /^cas-(1[0-5]|[0-9])$/;

/** The objects that each call reached, in order, and the request each one received. */
interface Calls {
  readonly names: MutableList.MutableList<string>;
  readonly requests: MutableList.MutableList<Request>;
}

/** The names of the objects that the calls reached, in the order of the calls. */
const namesOf = (calls: Calls): string[] => MutableList.toArray(calls.names);

/**
 * A namespace whose objects answer with `reply`. `reply` receives the number of
 * the call, starting at 1, so a test can fail the first call and answer the second.
 */
function namespaceAnswering(reply: (attempt: number) => Promise<Response>): {
  readonly namespace: CasSolverNamespace;
  readonly calls: Calls;
} {
  const calls: Calls = {
    names: MutableList.make<string>(),
    requests: MutableList.make<Request>(),
  };
  const namespace: CasSolverNamespace = {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (request) => {
        MutableList.append(calls.names, String(id));
        MutableList.append(calls.requests, request);
        return reply(namesOf(calls).length);
      },
    }),
  };
  return { namespace, calls };
}

/** An object that holds its call and never answers. */
const silent = (): Promise<Response> => new Promise<Response>(() => undefined);

/** An object that answers with the overloaded error of the runtime. */
const overloaded = (): Promise<Response> =>
  Promise.reject(Object.assign(new Error("busy"), { overloaded: true }));

/** An object that fails without the overloaded flag. */
const failed = (): Promise<Response> =>
  Promise.reject(new Error("exceeded resource limits"));

/** An object that answers with a verified result. */
const answered = (): Promise<Response> =>
  Promise.resolve(new Response('{"status":"verified"}', { status: 200 }));

describe("forwardMath", () => {
  it.effect("sends the body to a pooled object and returns its response", () =>
    Effect.gen(function* () {
      const { namespace, calls } = namespaceAnswering(answered);

      const response = yield* forwardMath(
        namespace,
        new TextEncoder().encode('{"kind":"math"}')
      );

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.text())).toBe(
        '{"status":"verified"}'
      );
      const names = namesOf(calls);
      expect(names).toHaveLength(1);
      expect(names[0]).toMatch(POOLED_NAME);
      const [sent] = MutableList.toArray(calls.requests);
      expect(sent?.url).toBe("https://cas.internal/api/math");
      expect(sent?.method).toBe("POST");
      expect(
        yield* Effect.promise(() =>
          sent === undefined ? Promise.resolve("") : sent.text()
        )
      ).toBe('{"kind":"math"}');
    })
  );

  it.effect("asks a different object once when an object is overloaded", () =>
    Effect.gen(function* () {
      const { namespace, calls } = namespaceAnswering((attempt) =>
        attempt === 1 ? overloaded() : answered()
      );

      const response = yield* forwardMath(namespace, new Uint8Array(0));

      const [first, second] = namesOf(calls);
      expect(response.status).toBe(200);
      expect(namesOf(calls)).toHaveLength(2);
      expect(second).toMatch(POOLED_NAME);
      expect(second).not.toBe(first);
    })
  );

  it.effect("asks a different object once after another engine failure", () =>
    Effect.gen(function* () {
      const { namespace, calls } = namespaceAnswering((attempt) =>
        attempt === 1 ? failed() : answered()
      );

      const response = yield* forwardMath(namespace, new Uint8Array(0));

      const [first, second] = namesOf(calls);
      expect(response.status).toBe(200);
      expect(namesOf(calls)).toHaveLength(2);
      expect(second).not.toBe(first);
    })
  );

  it.effect("reports the second object's failure when both objects fail", () =>
    Effect.gen(function* () {
      const { namespace, calls } = namespaceAnswering(overloaded);

      const result = yield* Effect.result(
        forwardMath(namespace, new Uint8Array(0))
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasEngineFailed);
        expect(result.failure).toMatchObject({ overloaded: true });
      }
      expect(namesOf(calls)).toHaveLength(2);
    })
  );

  it.effect("reports other engine failures as not overloaded", () =>
    Effect.gen(function* () {
      const { namespace } = namespaceAnswering(failed);

      const result = yield* Effect.result(
        forwardMath(namespace, new Uint8Array(0))
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasEngineFailed);
        expect(result.failure).toMatchObject({ overloaded: false });
      }
    })
  );

  it.effect(
    "asks a different object once when the first misses its deadline",
    () =>
      Effect.gen(function* () {
        const { namespace, calls } = namespaceAnswering((attempt) =>
          attempt === 1 ? silent() : answered()
        );

        const fiber = yield* Effect.forkChild(
          forwardMath(namespace, new Uint8Array(0)),
          { startImmediately: true }
        );
        yield* TestClock.adjust("25 seconds");
        const response = yield* Fiber.join(fiber);

        const [first, second] = namesOf(calls);
        expect(response.status).toBe(200);
        expect(namesOf(calls)).toHaveLength(2);
        expect(second).not.toBe(first);
      })
  );

  it.effect("gives up once both objects miss their deadline", () =>
    Effect.gen(function* () {
      const { namespace, calls } = namespaceAnswering(silent);

      const fiber = yield* Effect.forkChild(
        Effect.result(forwardMath(namespace, new Uint8Array(0))),
        { startImmediately: true }
      );
      yield* TestClock.adjust("25 seconds");
      yield* TestClock.adjust("25 seconds");
      const result = yield* Fiber.join(fiber);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasEngineTimedOut);
        expect(result.failure).toMatchObject({ budget: "25 seconds" });
      }
      expect(namesOf(calls)).toHaveLength(2);
    })
  );
});
