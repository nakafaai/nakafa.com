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

/** A namespace whose objects answer with `reply`, and which records each call. */
function namespaceReplying(
  reply: (request: Request) => Promise<Response>,
  record: { call?: Call }
): CasSolverNamespace {
  return {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (request) => {
        record.call = { name: String(id), request };
        return reply(request);
      },
    }),
  };
}

describe("forwardMath", () => {
  it.effect("sends the body to a pooled object and returns its response", () =>
    Effect.gen(function* () {
      const record: { call?: Call } = {};
      const namespace = namespaceReplying(
        () =>
          Promise.resolve(
            new Response('{"status":"verified"}', { status: 200 })
          ),
        record
      );

      const response = yield* forwardMath(
        namespace,
        new TextEncoder().encode('{"kind":"math"}')
      );

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.text())).toBe(
        '{"status":"verified"}'
      );
      const sent = record.call?.request;
      expect(record.call?.name).toMatch(POOLED_NAME);
      expect(sent?.url).toBe("https://cas.internal/api/math");
      expect(sent?.method).toBe("POST");
      expect(
        yield* Effect.promise(() =>
          sent === undefined ? Promise.resolve("") : sent.text()
        )
      ).toBe('{"kind":"math"}');
    })
  );

  it.effect("reports an overloaded object as overloaded", () =>
    Effect.gen(function* () {
      const namespace = namespaceReplying(
        () =>
          Promise.reject(
            Object.assign(new Error("busy"), { overloaded: true })
          ),
        {}
      );

      const result = yield* Effect.result(
        forwardMath(namespace, new Uint8Array(0))
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
        {}
      );

      const result = yield* Effect.result(
        forwardMath(namespace, new Uint8Array(0))
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.overloaded).toBe(false);
      }
    })
  );
});
