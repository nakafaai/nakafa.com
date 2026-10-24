import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answer, type CasFrontEnv, MAX_REQUEST_BYTES } from "@/front/answer";
import type { CasSolverStub } from "@/front/forward";

const KEY = "front-test-key";
const MATH_URL = "https://cas.nakafa.test/api/math";

function environment(
  stub: CasSolverStub,
  key: string | undefined = KEY
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

function send(request: Request, env: CasFrontEnv): Promise<Response> {
  return Effect.runPromise(answer(request, env));
}

describe("answer", () => {
  it("answers the health path without the bearer key", async () => {
    const response = await send(
      new Request("https://cas.nakafa.test/health"),
      environment(engineReplying(500, ""), undefined)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("refuses a method that the path does not accept", async () => {
    const health = await send(
      new Request("https://cas.nakafa.test/health", { method: "POST" }),
      environment(engineReplying(500, ""))
    );
    const math = await send(
      new Request(MATH_URL, { method: "GET" }),
      environment(engineReplying(500, ""))
    );

    expect(health.status).toBe(405);
    expect(health.headers.get("allow")).toBe("GET");
    expect(math.status).toBe(405);
    expect(math.headers.get("allow")).toBe("POST");
  });

  it("answers any other path as not found", async () => {
    const response = await send(
      new Request("https://cas.nakafa.test/"),
      environment(engineReplying(500, ""))
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Not found." });
  });

  it("answers the math path as unconfigured when no key is bound", async () => {
    const response = await send(
      mathRequest(),
      environment(engineReplying(500, ""), "")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      detail: "The math service is not configured.",
    });
  });

  it("refuses a missing or wrong bearer key before it reads the body", async () => {
    const missing = await send(
      mathRequest('{"kind":"math"}', null),
      environment(engineReplying(200, "{}"))
    );
    const wrong = await send(
      mathRequest('{"kind":"math"}', "Bearer not-the-key"),
      environment(engineReplying(200, "{}"))
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ detail: "Invalid CAS API key." });
  });

  it("forwards an authorized body and returns the engine's response", async () => {
    const response = await send(
      mathRequest(),
      environment(engineReplying(200, '{"status":"verified"}'))
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "verified" });
  });

  it("refuses a body over the limit before the engine runs", async () => {
    let calls = 0;
    const counting: CasSolverStub = {
      fetch: () => {
        calls += 1;
        return Promise.resolve(new Response("{}"));
      },
    };

    const response = await send(
      mathRequest("x".repeat(MAX_REQUEST_BYTES + 1)),
      environment(counting)
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      detail: "Math request exceeds the supported size.",
    });
    expect(calls).toBe(0);
  });

  it("answers an unreadable body with a bad request", async () => {
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

    const response = await send(
      request,
      environment(engineReplying(200, "{}"))
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      detail: "Math request could not be read.",
    });
  });

  it("answers a busy engine object with a retryable unavailable status", async () => {
    const busy: CasSolverStub = {
      fetch: () =>
        Promise.reject(
          Object.assign(new Error("overloaded"), { overloaded: true })
        ),
    };

    const response = await send(mathRequest(), environment(busy));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      detail: "Math service is busy. Please retry shortly.",
    });
  });

  it("answers an engine failure with an unavailable status", async () => {
    const failing: CasSolverStub = {
      fetch: () => Promise.reject(new Error("exceeded resource limits")),
    };

    const response = await send(mathRequest(), environment(failing));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      detail: "Math calculation could not complete.",
    });
  });
});
