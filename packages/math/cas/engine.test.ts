import { CasEngine } from "@repo/math/cas/engine";
import { MathCasRequestError, MathCasResponseError } from "@repo/math/errors";
import type { MathRequest } from "@repo/math/schema/request";
import type { MathResult } from "@repo/math/schema/result";
import { ConfigProvider, Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config = ConfigProvider.fromMap(
  new Map([
    ["NEXT_PUBLIC_CAS_URL", "https://cas.test"],
    ["MATH_CAS_API_KEY", "secret"],
  ])
);

describe("CasEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a CAS request with configured URL and bearer token", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify(casResult()), {
        headers: { "content-type": "application/json" },
        status: 200,
      })
    );

    const result = await Effect.runPromise(computeWithLiveCas());

    expect(result.status).toBe("verified");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/api/math", "https://cas.test"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        }),
        method: "POST",
      })
    );
  });

  it("keeps network failures and unreadable JSON in typed errors", async () => {
    stubFetchFailure(new TypeError("offline"));
    const requestExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(requestExit)).toBeInstanceOf(MathCasRequestError);

    stubFetch(
      new Response("not json", {
        headers: { "content-type": "application/json" },
        status: 200,
      })
    );
    const responseExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(responseExit)).toBeInstanceOf(MathCasResponseError);
  });

  it("maps invalid success payloads and CAS error bodies into typed failures", async () => {
    stubFetch(
      new Response(JSON.stringify({ status: "verified" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      })
    );
    const invalidPayloadExit = await Effect.runPromiseExit(
      computeWithLiveCas()
    );

    expect(exitFailure(invalidPayloadExit)).toBeInstanceOf(
      MathCasResponseError
    );

    stubFetch(
      new Response(JSON.stringify({ detail: "Bad expression." }), {
        headers: { "content-type": "application/json" },
        status: 422,
      })
    );
    const stringDetailExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(stringDetailExit)).toMatchObject({
      message: "Bad expression.",
      status: 422,
    });

    stubFetch(
      new Response(
        JSON.stringify({
          detail: [
            { msg: "Missing expression." },
            { msg: "Invalid variable." },
          ],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 400,
        }
      )
    );
    const listDetailExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(listDetailExit)).toMatchObject({
      message: "Missing expression. Invalid variable.",
      status: 400,
    });
  });

  it("falls back to status messages when CAS error text is unusable", async () => {
    stubFetch(new Response("", { status: 502 }));
    const emptyExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(emptyExit)).toMatchObject({
      message: "Math request failed with status 502.",
    });

    stubFetch(
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
        status: 503,
      })
    );
    const htmlExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(htmlExit)).toMatchObject({
      message: "Math request failed with status 503.",
    });

    stubFetch(
      new Response("{", {
        headers: { "content-type": "application/json" },
        status: 500,
      })
    );
    const invalidJsonExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(invalidJsonExit)).toMatchObject({
      message: "Math request failed with status 500.",
    });

    const rejectingTextResponse = new Response("ignored", { status: 504 });
    Object.defineProperty(rejectingTextResponse, "text", {
      value: () => Promise.reject(new TypeError("unreadable body")),
    });
    stubFetch(rejectingTextResponse);
    const unreadableExit = await Effect.runPromiseExit(computeWithLiveCas());

    expect(exitFailure(unreadableExit)).toMatchObject({
      message: "Math request failed with status 504.",
    });
  });
});

/** Installs a fetch mock that resolves to one response. */
function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Installs a fetch mock that rejects with one network failure. */
function stubFetchFailure(error: unknown) {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockRejectedValue(error);
  vi.stubGlobal("fetch", fetchMock);
}

/** Runs the live CAS service against the mocked fetch boundary. */
function computeWithLiveCas() {
  return Effect.gen(function* () {
    const cas = yield* CasEngine;
    return yield* cas.compute(casRequest());
  }).pipe(Effect.provide(CasEngine.Default), Effect.withConfigProvider(config));
}

/** Builds a representative first-slice CAS request. */
function casRequest(): MathRequest {
  return {
    expression: "x + 1",
    kind: "math",
    operation: "simplify",
  };
}

/** Builds a valid CAS response fixture. */
function casResult(): MathResult {
  return {
    conditions: [],
    input: casRequest(),
    items: [],
    kind: "simplify",
    operation: "simplify",
    primary: { expression: "x + 1", latex: "x+1" },
    reason: "checked",
    secondary: { expression: "x + 1", latex: "x+1" },
    stepStatus: "complete",
    steps: [],
    status: "verified",
  };
}

/** Reads the expected failure value from an Effect exit. */
function exitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
    return exit.cause.error;
  }

  expect.fail("Expected Effect failure exit.");
}
