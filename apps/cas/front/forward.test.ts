import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  CasEngineFailed,
  type CasSolverNamespace,
  forwardMath,
} from "@/front/forward";

const POOLED_NAME = /^cas-[0-7]$/;

interface Call {
  readonly name: string;
  readonly request: Request;
}

/** A namespace whose objects answer with `reply`, and record each call. */
function namespaceReplying(
  reply: (request: Request) => Promise<Response>,
  calls: Call[]
): CasSolverNamespace {
  return {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (request) => {
        calls.push({ name: String(id), request });
        return reply(request);
      },
    }),
  };
}

describe("forwardMath", () => {
  it.effect("sends the body to a pooled object and returns its response", () =>
    Effect.gen(function* () {
      const calls: Call[] = [];
      const namespace = namespaceReplying(
        () =>
          Promise.resolve(
            new Response('{"status":"verified"}', { status: 200 })
          ),
        calls
      );

      const response = yield* forwardMath(
        namespace,
        new TextEncoder().encode('{"kind":"math"}')
      );

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.text())).toBe(
        '{"status":"verified"}'
      );
      expect(calls).toHaveLength(1);
      const [call] = calls;
      expect(call?.name).toMatch(POOLED_NAME);
      expect(call?.request.url).toBe("https://cas.internal/api/math");
      expect(call?.request.method).toBe("POST");
      expect(yield* Effect.promise(() => call.request.text())).toBe(
        '{"kind":"math"}'
      );
    })
  );

  it.effect("reports an overloaded object as overloaded", () =>
    Effect.gen(function* () {
      const namespace = namespaceReplying(
        () =>
          Promise.reject(
            Object.assign(new Error("busy"), { overloaded: true })
          ),
        []
      );

      const result = yield* Effect.result(
        forwardMath(namespace, new Uint8Array())
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasEngineFailed);
        expect(result.failure.overloaded).toBe(true);
      }
    })
  );

  it.effect("reports other engine failures as not overloaded", () =>
    Effect.gen(function* () {
      const namespace = namespaceReplying(
        () => Promise.reject(new Error("exceeded resource limits")),
        []
      );

      const result = yield* Effect.result(
        forwardMath(namespace, new Uint8Array())
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.overloaded).toBe(false);
      }
    })
  );
});
