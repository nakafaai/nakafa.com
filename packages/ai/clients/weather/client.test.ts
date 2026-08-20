import { getCurrentWeather } from "@repo/ai/clients/weather/client";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Effect, Layer, Result } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { vi } from "vitest";

const latitude = "-6.2088";
const longitude = "106.8456";
const currentWeatherResponse = {
  base: "stations",
  cod: 200,
  coord: {
    lat: -6.2088,
    lon: 106.8456,
  },
  main: {
    feels_like: 305.2,
    humidity: 78,
    pressure: 1010,
    temp: 300.4,
    temp_max: 301,
    temp_min: 300,
  },
  name: "Jakarta",
  sys: {
    country: "ID",
    sunrise: 1_779_309_600,
    sunset: 1_779_352_800,
  },
  weather: [
    {
      description: "light rain",
      icon: "10d",
      id: 500,
      main: "Rain",
    },
  ],
};
interface WeatherClientInput {
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response;
  observeRequest?: (request: HttpClientRequest.HttpClientRequest) => void;
}
/** Builds an Effect HTTP client with a deterministic OpenWeather response. */
function makeWeatherClient({
  makeResponse,
  observeRequest = () => undefined,
}: WeatherClientInput) {
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
/** Provides a deterministic HTTP layer to the public weather program. */
function runWeather(
  makeResponse: WeatherClientInput["makeResponse"],
  observeRequest?: WeatherClientInput["observeRequest"]
) {
  return getCurrentWeather({ latitude, longitude }).pipe(
    Effect.provide(makeWeatherClient({ makeResponse, observeRequest })),
    Effect.result
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("getCurrentWeather", () => {
  it.live("returns a narrow summary from one current-weather request", () =>
    Effect.gen(function* () {
      vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
      const observeRequest =
        vi.fn<(request: HttpClientRequest.HttpClientRequest) => void>();
      const result = yield* runWeather(
        () => Response.json(currentWeatherResponse),
        observeRequest
      );
      expect(result).toEqual(
        Result.succeed({
          city: "Jakarta",
          condition: "light rain",
          country: "ID",
          icon: "10d",
          temperatureKelvin: 300.4,
        })
      );
      expect(observeRequest).toHaveBeenCalledTimes(1);
      const request = observeRequest.mock.calls[0]?.[0];
      expect(request).toMatchObject({
        method: "GET",
        url: "https://api.openweathermap.org/data/2.5/weather",
      });
      expect(request?.urlParams.params).toEqual([
        ["appid", "weather-key"],
        ["lat", latitude],
        ["lon", longitude],
      ]);
    })
  );
  it.live(
    "keeps an unavailable current-weather request in the typed error channel",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
        const result = yield* runWeather(
          () => new Response("unauthorized", { status: 401 })
        );
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isSuccess(result)) {
          return;
        }
        expect(result.failure).toMatchObject({
          _tag: "WeatherClientRequestError",
          endpoint: "current-weather",
        });
      })
  );
  it.live("keeps an invalid response in the schema error channel", () =>
    Effect.gen(function* () {
      vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
      const result = yield* runWeather(() => Response.json({ cod: 200 }));
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isSuccess(result)) {
        return;
      }
      expect(result.failure).toMatchObject({ _tag: "SchemaError" });
    })
  );
  it.live(
    "preserves the visible condition defaults when conditions are absent",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("OPENWEATHER_API_KEY", "weather-key");
        const result = yield* runWeather(() =>
          Response.json({
            ...currentWeatherResponse,
            weather: [],
          })
        );
        expect(result).toEqual(
          Result.succeed(
            expect.objectContaining({
              condition: "Clear",
              icon: "01d",
            })
          )
        );
      })
  );
});
