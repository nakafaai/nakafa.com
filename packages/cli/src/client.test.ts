import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref, Result } from "effect";
import {
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { requestNakafaApi } from "#cli/client";

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

function makeClient(
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response
) {
  return HttpClient.make((request) =>
    Effect.sync(() =>
      HttpClientResponse.fromWeb(request, makeResponse(request))
    )
  );
}

function execute(client: HttpClient.HttpClient, apiBase: string) {
  return requestNakafaApi({ apiBase, path: "/v1/health" }).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
}

function runFailure(response: Response) {
  return execute(
    makeClient(() => response),
    "https://api.nakafa.com"
  ).pipe(Effect.result);
}

describe("Nakafa API client", () => {
  it.effect("requests and decodes a successful JSON response", () =>
    Effect.gen(function* () {
      const requests = yield* Ref.make<
        readonly HttpClientRequest.HttpClientRequest[]
      >([]);
      const client = HttpClient.make((request) =>
        Ref.update(requests, (current) => [...current, request]).pipe(
          Effect.as(
            HttpClientResponse.fromWeb(request, Response.json({ status: "ok" }))
          )
        )
      );

      expect(yield* execute(client, "https://api.nakafa.com")).toEqual({
        status: "ok",
      });
      const [request] = yield* Ref.get(requests);
      expect(request?.method).toBe("GET");
      expect(request?.url).toBe("https://api.nakafa.com/v1/health");
      expect(request?.headers.accept).toBe(
        "application/json, application/problem+json"
      );
    })
  );

  it.effect(
    "never forwards an internal edge secret to a custom API origin",
    () =>
      Effect.gen(function* () {
        const requests = yield* Ref.make<
          readonly HttpClientRequest.HttpClientRequest[]
        >([]);
        const client = HttpClient.make((request) =>
          Ref.update(requests, (current) => [...current, request]).pipe(
            Effect.as(
              HttpClientResponse.fromWeb(
                request,
                Response.json({ status: "ok" })
              )
            )
          )
        );

        yield* execute(client, "https://attacker.example");

        const [request] = yield* Ref.get(requests);
        expect(request?.headers.accept).toBe(
          "application/json, application/problem+json"
        );
        expect(request?.headers.authorization).toBeUndefined();
        expect(request?.headers.cookie).toBeUndefined();
      })
  );

  it.effect("preserves a valid Problem Details response", () =>
    Effect.gen(function* () {
      const result = yield* runFailure(Response.json(problem, { status: 404 }));

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

  it.effect("rejects non-JSON and malformed error responses", () =>
    Effect.gen(function* () {
      const nonJson = yield* runFailure(
        new Response("not JSON", {
          headers: { "content-type": "application/problem+json" },
          status: 502,
        })
      );
      const malformedProblem = yield* runFailure(
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

  it.effect("preserves non-JSON edge status and retry guidance", () =>
    Effect.gen(function* () {
      const result = yield* runFailure(
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

  it.effect("preserves non-JSON edge failures without retry guidance", () =>
    Effect.gen(function* () {
      const result = yield* runFailure(
        new Response("unavailable", { status: 503 })
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

  it.effect(
    "classifies request and response-reading failures as network errors",
    () =>
      Effect.gen(function* () {
        const requestClient = HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                cause: new Error("offline"),
                request,
              }),
            })
          )
        );
        const requestFailure = yield* execute(
          requestClient,
          "https://api.nakafa.com"
        ).pipe(Effect.result);
        const readFailure = yield* runFailure(
          new Response(
            new ReadableStream({
              start: (controller) => {
                controller.error(new Error("body unavailable"));
              },
            })
          )
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
