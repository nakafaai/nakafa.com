import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answer, MAX_REQUEST_BYTES } from "@/front/answer";
import type { CasFrontEnv, CasSolverStub } from "@/front/forward";

const KEY = "front-test-key";
const MATH_URL = "https://cas.nakafa.test/api/math";

function environment(
  stub: CasSolverStub,
  key: string | undefined
): CasFrontEnv {
  return {
    CAS_SOLVER: { idFromName: (name) => name, get: () => stub },
    MATH_CAS_API_KEY: key,
  };
}

function engineReplying(status: number, body: string): CasSolverStub {
  return {
    fetch: () =>
      Promise.resolve(
        new Response(body, {
          status,
          headers: { "content-type": "application/json" },
        })
      ),
  };
}

function mathRequest(
  body: BodyInit | null = '{"kind":"math","operation":"evaluate"}',
  authorization: string | null = `Bearer ${KEY}`
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== null) {
    headers.set("authorization", authorization);
  }
  return new Request(MATH_URL, { method: "POST", headers, body });
}

describe("answer", () => {
  it.effect("answers the health path without the bearer key", () =>
    Effect.gen(function* () {
      const response = yield* answer(
        new Request("https://cas.nakafa.test/health"),
        environment(engineReplying(500, ""), undefined)
      );

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        status: "ok",
      });
    })
  );

  it.effect("refuses a method that the path does not accept", () =>
    Effect.gen(function* () {
      const env = environment(engineReplying(500, ""), KEY);
      const health = yield* answer(
        new Request("https://cas.nakafa.test/health", { method: "POST" }),
        env
      );
      const math = yield* answer(new Request(MATH_URL, { method: "GET" }), env);

      expect(health.status).toBe(405);
      expect(health.headers.get("allow")).toBe("GET");
      expect(math.status).toBe(405);
      expect(math.headers.get("allow")).toBe("POST");
    })
  );

  it.effect("answers any other path as not found", () =>
    Effect.gen(function* () {
      const response = yield* answer(
        new Request("https://cas.nakafa.test/"),
        environment(engineReplying(500, ""), KEY)
      );

      expect(response.status).toBe(404);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        detail: "Not found.",
      });
    })
  );

  it.effect("answers the math path as unconfigured when no key is bound", () =>
    Effect.gen(function* () {
      const response = yield* answer(
        mathRequest(),
        environment(engineReplying(500, ""), "")
      );

      expect(response.status).toBe(500);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        detail: "The math service is not configured.",
      });
    })
  );

  it.effect("refuses a missing or wrong bearer key", () =>
    Effect.gen(function* () {
      const env = environment(engineReplying(200, "{}"), KEY);
      const missing = yield* answer(mathRequest(undefined, null), env);
      const wrong = yield* answer(mathRequest(undefined, "Bearer nope"), env);

      expect(missing.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(yield* Effect.promise(() => wrong.json())).toEqual({
        detail: "Invalid CAS API key.",
      });
    })
  );

  it.effect(
    "forwards an authorized body and returns the engine's response",
    () =>
      Effect.gen(function* () {
        const response = yield* answer(
          mathRequest(),
          environment(engineReplying(200, '{"status":"verified"}'), KEY)
        );

        expect(response.status).toBe(200);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          status: "verified",
        });
      })
  );

  it.effect("refuses a body over the limit before the engine runs", () =>
    Effect.gen(function* () {
      const counter = { calls: 0 };
      const counting: CasSolverStub = {
        fetch: () => {
          counter.calls += 1;
          return Promise.resolve(new Response("{}"));
        },
      };

      const response = yield* answer(
        mathRequest("x".repeat(MAX_REQUEST_BYTES + 1)),
        environment(counting, KEY)
      );

      expect(response.status).toBe(422);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        detail: "Math request exceeds the supported size.",
      });
      expect(counter.calls).toBe(0);
    })
  );

  it.effect("answers an unreadable body with a bad request", () =>
    Effect.gen(function* () {
      const failing = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("connection reset"));
        },
      });
      const init = { method: "POST", body: failing, duplex: "half" };
      const request = new Request(MATH_URL, {
        ...init,
        headers: { authorization: `Bearer ${KEY}` },
      });

      const response = yield* answer(
        request,
        environment(engineReplying(200, "{}"), KEY)
      );

      expect(response.status).toBe(400);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        detail: "Math request could not be read.",
      });
    })
  );

  it.effect(
    "answers a busy engine object with a retryable unavailable status",
    () =>
      Effect.gen(function* () {
        const busy: CasSolverStub = {
          fetch: () =>
            Promise.reject(
              Object.assign(new Error("overloaded"), { overloaded: true })
            ),
        };

        const response = yield* answer(mathRequest(), environment(busy, KEY));

        expect(response.status).toBe(503);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          detail: "Math service is busy. Please retry shortly.",
        });
      })
  );

  it.effect("answers an engine failure with an unavailable status", () =>
    Effect.gen(function* () {
      const failing: CasSolverStub = {
        fetch: () => Promise.reject(new Error("exceeded resource limits")),
      };

      const response = yield* answer(mathRequest(), environment(failing, KEY));

      expect(response.status).toBe(503);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        detail: "Math calculation could not complete.",
      });
    })
  );
});
