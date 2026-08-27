import { describe, expect, it } from "@effect/vitest";
import { requestWeatherJson } from "@repo/ai/clients/weather/transport";
import { Effect, Fiber, Layer, Result } from "effect";
import { TestClock } from "effect/testing";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { vi } from "vitest";

interface TestClientInput {
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response;
  observeRequest?: (request: HttpClientRequest.HttpClientRequest) => void;
}
/** Builds a deterministic Effect HTTP client for transport tests. */
function makeTestClient({
  makeResponse,
  observeRequest = () => undefined,
}: TestClientInput) {
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        observeRequest(request);
        return HttpClientResponse.fromWeb(request, makeResponse(request));
      })
    )
  );
}
describe("requestWeatherJson", () => {
  it.effect("sends query parameters and returns decoded JSON", () =>
    Effect.gen(function* () {
      const observeRequest =
        vi.fn<(request: HttpClientRequest.HttpClientRequest) => void>();
      const result = yield* requestWeatherJson({
        endpoint: "current-weather",
        searchParams: {
          appid: "weather-key",
          lat: "-6.2088",
        },
        url: "https://weather.example.test/weather",
      }).pipe(
        Effect.provide(
          makeTestClient({
            makeResponse: () => Response.json({ cod: "200" }),
            observeRequest,
          })
        )
      );
      expect(result).toEqual({ cod: "200" });
      const request = observeRequest.mock.calls[0]?.[0];
      expect(request).toMatchObject({
        method: "GET",
        url: "https://weather.example.test/weather",
      });
      expect(request?.urlParams.params).toEqual([
        ["appid", "weather-key"],
        ["lat", "-6.2088"],
      ]);
      expect(request?.headers).not.toHaveProperty("b3");
      expect(request?.headers).not.toHaveProperty("traceparent");
    })
  );
  it.effect("maps rejected HTTP status into the weather error contract", () =>
    Effect.gen(function* () {
      const result = yield* requestWeatherJson({
        endpoint: "current-weather",
        searchParams: {
          appid: "weather-secret",
        },
        url: "https://weather.example.test/weather",
      }).pipe(
        Effect.provide(
          makeTestClient({
            makeResponse: () =>
              new Response("unauthorized", {
                status: 401,
              }),
          })
        ),
        Effect.result
      );
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isSuccess(result)) {
        return;
      }
      expect(result.failure).toMatchObject({
        _tag: "WeatherClientRequestError",
        endpoint: "current-weather",
        message: "OpenWeather request failed for current-weather.",
      });
      expect(JSON.stringify(result.failure)).not.toContain("weather-secret");
      expect(JSON.stringify(result.failure)).not.toContain(
        "https://weather.example.test/weather"
      );
    })
  );
  it.effect("retries transient HTTP failures before returning JSON", () =>
    Effect.gen(function* () {
      const makeResponse = vi
        .fn<(request: HttpClientRequest.HttpClientRequest) => Response>()
        .mockReturnValueOnce(new Response("unavailable", { status: 503 }))
        .mockReturnValueOnce(Response.json({ cod: "200" }));
      const resultFiber = yield* requestWeatherJson({
        endpoint: "current-weather",
        searchParams: {},
        url: "https://weather.example.test/weather",
      }).pipe(
        Effect.provide(makeTestClient({ makeResponse })),
        Effect.forkChild
      );
      yield* TestClock.adjust("300 millis");
      const result = yield* Fiber.join(resultFiber);
      expect(result).toEqual({ cod: "200" });
      expect(makeResponse).toHaveBeenCalledTimes(2);
    })
  );
});
