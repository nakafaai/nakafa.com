import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";
import { type FetchImplementation, requestNakafaApi } from "./client.js";

const problem = {
  code: "NOT_FOUND",
  detail: "The requested content does not exist.",
  instance: "/v1/content",
  request_id: "request-123",
  resolution: "Use a content ID returned by search.",
  status: 404,
  title: "Not found",
  type: "https://nakafa.com/problems/not-found",
};

function runFailure(fetchImplementation: typeof fetch) {
  return Effect.runPromise(
    requestNakafaApi({
      apiBase: "https://api.nakafa.com",
      fetchImplementation,
      path: "/v1/health",
    }).pipe(Effect.result)
  );
}

describe("Nakafa API client", () => {
  it("requests and decodes a successful JSON response", async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      Response.json({ status: "ok" })
    );

    await expect(
      Effect.runPromise(
        requestNakafaApi({
          apiBase: "https://api.nakafa.com",
          fetchImplementation,
          path: "/v1/health",
        })
      )
    ).resolves.toEqual({ status: "ok" });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.nakafa.com/v1/health",
      {
        headers: expect.any(Headers),
        method: "GET",
      }
    );
    const request = fetchImplementation.mock.calls[0]?.[1];
    expect(new Headers(request?.headers).get("accept")).toBe(
      "application/json, application/problem+json"
    );
  });

  it("authenticates an explicitly configured isolated API origin", async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      Response.json({ status: "ok" })
    );

    await Effect.runPromise(
      requestNakafaApi({
        apiBase: "https://isolated.example.com",
        apiEdgeSecret: "temporary-isolated-secret",
        fetchImplementation,
        path: "/v1/health",
      })
    );

    const request = fetchImplementation.mock.calls[0]?.[1];
    expect(new Headers(request?.headers).get("x-nakafa-api-edge-secret")).toBe(
      "temporary-isolated-secret"
    );
  });

  it("preserves a valid Problem Details response", async () => {
    const result = await runFailure(async () =>
      Response.json(problem, { status: 404 })
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toMatchObject({
        _tag: "ApiResponseError",
        problem,
        status: 404,
      });
    }
  });

  it("rejects non-JSON and malformed error responses", async () => {
    const nonJson = await runFailure(
      async () => new Response("not JSON", { status: 502 })
    );
    const malformedProblem = await runFailure(async () =>
      Response.json({ message: "missing fields" }, { status: 400 })
    );

    expect(Result.isFailure(nonJson) && nonJson.failure._tag).toBe(
      "ResponseDecodeError"
    );
    expect(
      Result.isFailure(malformedProblem) && malformedProblem.failure._tag
    ).toBe("ResponseDecodeError");
  });

  it("classifies request and response-reading failures as network errors", async () => {
    const requestFailure = await runFailure(() => {
      throw new Error("offline");
    });
    class UnreadableResponse extends Response {
      override text() {
        return Promise.reject(new Error("body unavailable"));
      }
    }
    const readFailure = await runFailure(async () => new UnreadableResponse());

    expect(
      Result.isFailure(requestFailure) && requestFailure.failure._tag
    ).toBe("NetworkError");
    expect(Result.isFailure(readFailure) && readFailure.failure._tag).toBe(
      "NetworkError"
    );
  });
});
