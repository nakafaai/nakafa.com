import { describe, expect, it, vi } from "@repo/testing/effect";
import { Effect, Result } from "effect";
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

function runFailure(fetchImplementation: FetchImplementation) {
  return requestNakafaApi({
    apiBase: "https://api.nakafa.com",
    fetchImplementation,
    path: "/v1/health",
  }).pipe(Effect.result);
}

describe("Nakafa API client", () => {
  it.live("requests and decodes a successful JSON response", () =>
    Effect.gen(function* () {
      const fetchImplementation = vi.fn<FetchImplementation>(async () =>
        Response.json({ status: "ok" })
      );

      expect(
        yield* requestNakafaApi({
          apiBase: "https://api.nakafa.com",
          fetchImplementation,
          path: "/v1/health",
        })
      ).toEqual({ status: "ok" });
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
    })
  );

  it.live("never forwards an internal edge secret to a custom API origin", () =>
    Effect.gen(function* () {
      const fetchImplementation = vi.fn<FetchImplementation>(async () =>
        Response.json({ status: "ok" })
      );

      yield* requestNakafaApi({
        apiBase: "https://attacker.example",
        fetchImplementation,
        path: "/v1/health",
      });

      const request = fetchImplementation.mock.calls[0]?.[1];
      expect([...new Headers(request?.headers)]).toEqual([
        ["accept", "application/json, application/problem+json"],
      ]);
    })
  );

  it.live("preserves a valid Problem Details response", () =>
    Effect.gen(function* () {
      const result = yield* runFailure(async () =>
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
    })
  );

  it.live("rejects non-JSON and malformed error responses", () =>
    Effect.gen(function* () {
      const nonJson = yield* runFailure(
        async () =>
          new Response("not JSON", {
            headers: { "content-type": "application/problem+json" },
            status: 502,
          })
      );
      const malformedProblem = yield* runFailure(async () =>
        Response.json({ message: "missing fields" }, { status: 400 })
      );

      expect(Result.isFailure(nonJson) && nonJson.failure._tag).toBe(
        "ResponseDecodeError"
      );
      expect(
        Result.isFailure(malformedProblem) && malformedProblem.failure._tag
      ).toBe("ResponseDecodeError");
    })
  );

  it.live("preserves non-JSON edge status and retry guidance", () =>
    Effect.gen(function* () {
      const result = yield* runFailure(
        async () =>
          new Response("<html>rate limited</html>", {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "retry-after": "30",
            },
            status: 429,
          })
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toMatchObject({
          _tag: "HttpResponseError",
          retryAfter: "30",
          status: 429,
        });
      }
    })
  );

  it.live("preserves non-JSON edge failures without retry guidance", () =>
    Effect.gen(function* () {
      const result = yield* runFailure(
        async () => new Response("unavailable", { status: 503 })
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toMatchObject({
          _tag: "HttpResponseError",
          retryAfter: undefined,
          status: 503,
        });
      }
    })
  );

  it.live(
    "classifies request and response-reading failures as network errors",
    () =>
      Effect.gen(function* () {
        const requestFailure = yield* runFailure(() => {
          throw new Error("offline");
        });
        class UnreadableResponse extends Response {
          override text() {
            return Promise.reject(new Error("body unavailable"));
          }
        }
        const readFailure = yield* runFailure(
          async () => new UnreadableResponse()
        );

        expect(
          Result.isFailure(requestFailure) && requestFailure.failure._tag
        ).toBe("NetworkError");
        expect(Result.isFailure(readFailure) && readFailure.failure._tag).toBe(
          "NetworkError"
        );
      })
  );
});
