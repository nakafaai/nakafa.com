import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { requestWeatherJson } from "@repo/ai/clients/weather/transport";
import { Effect, Either, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

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
  it("sends query parameters and returns decoded JSON", async () => {
    const observeRequest =
      vi.fn<(request: HttpClientRequest.HttpClientRequest) => void>();
    const result = await Effect.runPromise(
      requestWeatherJson({
        endpoint: "forecast",
        searchParams: {
          appid: "weather-key",
          lat: "-6.2088",
        },
        url: "https://weather.example.test/forecast",
      }).pipe(
        Effect.provide(
          makeTestClient({
            makeResponse: () => Response.json({ cod: "200" }),
            observeRequest,
          })
        )
      )
    );

    expect(result).toEqual({ cod: "200" });
    expect(observeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "https://weather.example.test/forecast",
        urlParams: [
          ["appid", "weather-key"],
          ["lat", "-6.2088"],
        ],
      })
    );
    const request = observeRequest.mock.calls[0]?.[0];
    expect(request?.headers).not.toHaveProperty("b3");
    expect(request?.headers).not.toHaveProperty("traceparent");
  });

  it("maps rejected HTTP status into the weather error contract", async () => {
    const result = await Effect.runPromise(
      requestWeatherJson({
        endpoint: "forecast",
        searchParams: {
          appid: "weather-secret",
        },
        url: "https://weather.example.test/forecast",
      }).pipe(
        Effect.provide(
          makeTestClient({
            makeResponse: () =>
              new Response("unauthorized", {
                status: 401,
              }),
          })
        ),
        Effect.either
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }
    expect(result.left).toMatchObject({
      _tag: "WeatherClientRequestError",
      endpoint: "forecast",
      message: "OpenWeather request failed for forecast.",
    });
    expect(JSON.stringify(result.left)).not.toContain("weather-secret");
    expect(JSON.stringify(result.left)).not.toContain(
      "https://weather.example.test/forecast"
    );
  });

  it("retries transient HTTP failures before returning JSON", async () => {
    const makeResponse = vi
      .fn<(request: HttpClientRequest.HttpClientRequest) => Response>()
      .mockReturnValueOnce(new Response("unavailable", { status: 503 }))
      .mockReturnValueOnce(Response.json({ cod: "200" }));

    const result = await Effect.runPromise(
      requestWeatherJson({
        endpoint: "forecast",
        searchParams: {},
        url: "https://weather.example.test/forecast",
      }).pipe(Effect.provide(makeTestClient({ makeResponse })))
    );

    expect(result).toEqual({ cod: "200" });
    expect(makeResponse).toHaveBeenCalledTimes(2);
  });
});
